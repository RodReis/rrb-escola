import { describe, expect, it } from "vitest";
import {
  detectarTransferenciasInternas,
  type MovimentoConta,
} from "@/lib/conciliacao/transferencia-interna";

const deb = (id: string, contaId: string, data: string, valor: number): MovimentoConta =>
  ({ id, contaId, data, valor, tipo: "debito" });
const cred = (id: string, contaId: string, data: string, valor: number): MovimentoConta =>
  ({ id, contaId, data, valor, tipo: "credito" });

describe("detectarTransferenciasInternas", () => {
  it("casa débito e crédito de mesmo valor no mesmo dia, em contas diferentes", () => {
    const r = detectarTransferenciasInternas(
      [deb("d1", "A", "2026-01-07", 10000)],
      [cred("c1", "B", "2026-01-07", 10000)],
    );
    expect(r.pares).toEqual([{ debitoId: "d1", creditoId: "c1", contaDestinoId: "B" }]);
    expect(r.ambiguos).toEqual([]);
  });

  it("aceita 1 dia de diferença", () => {
    const r = detectarTransferenciasInternas(
      [deb("d1", "A", "2026-01-07", 500)],
      [cred("c1", "B", "2026-01-08", 500)],
    );
    expect(r.pares).toHaveLength(1);
  });

  it("não casa com 2 dias de diferença", () => {
    const r = detectarTransferenciasInternas(
      [deb("d1", "A", "2026-01-07", 500)],
      [cred("c1", "B", "2026-01-09", 500)],
    );
    expect(r.pares).toEqual([]);
  });

  it("não casa crédito na MESMA conta do débito", () => {
    const r = detectarTransferenciasInternas(
      [deb("d1", "A", "2026-01-07", 500)],
      [cred("c1", "A", "2026-01-07", 500)],
    );
    expect(r.pares).toEqual([]);
  });

  it("dois débitos iguais no mesmo dia consomem dois créditos distintos", () => {
    const r = detectarTransferenciasInternas(
      [deb("d1", "A", "2026-01-07", 500), deb("d2", "A", "2026-01-07", 500)],
      [cred("c1", "B", "2026-01-07", 500), cred("c2", "B", "2026-01-07", 500)],
    );
    expect(r.pares).toHaveLength(2);
    expect(new Set(r.pares.map((p) => p.creditoId)).size).toBe(2);
  });

  it("um débito com dois créditos possíveis vira ambíguo, não casa no chute", () => {
    const r = detectarTransferenciasInternas(
      [deb("d1", "A", "2026-01-07", 500)],
      [cred("c1", "B", "2026-01-07", 500), cred("c2", "C", "2026-01-07", 500)],
    );
    expect(r.pares).toEqual([]);
    expect(r.ambiguos).toEqual([{ debitoId: "d1", candidatos: ["c1", "c2"] }]);
  });

  it("compara em centavos inteiros: 0,01 de diferença não casa", () => {
    const r = detectarTransferenciasInternas(
      [deb("d1", "A", "2026-01-07", 125479.02)],
      [cred("c1", "B", "2026-01-07", 125479.01)],
    );
    expect(r.pares).toEqual([]);
  });
});
