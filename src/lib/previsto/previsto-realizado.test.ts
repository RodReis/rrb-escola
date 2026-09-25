import { describe, expect, it } from "vitest";
import { resumirPrevistoRealizado, type LinhaLancamento } from "@/lib/previsto/previsto-realizado";

const l = (over: Partial<LinhaLancamento>): LinhaLancamento => ({
  id: "x",
  categoria: "Impostos",
  valor: 100,
  status: "aberta",
  origemTipo: "manual",
  dataVencimento: "2026-09-20",
  descricao: "t",
  ...over,
});

describe("resumirPrevistoRealizado", () => {
  it("título pago conta nos dois lados; aberto só no previsto", () => {
    const r = resumirPrevistoRealizado(
      [l({ id: "1", valor: 100, status: "paga" }), l({ id: "2", valor: 50, status: "aberta" })],
      "2026-09-10",
    );
    expect(r.linhas).toEqual([
      { categoria: "Impostos", previsto: 150, realizado: 100, diferenca: -50, abertos: 1, vencidos: 0 },
    ]);
    expect(r.totais).toEqual({ previsto: 150, realizado: 100, diferenca: -50 });
  });

  it("débito classificado sem título é 'realizado sem previsto' e NÃO entra no previsto", () => {
    const r = resumirPrevistoRealizado([l({ id: "3", valor: 80, status: "paga", origemTipo: "extrato" })], "2026-09-10");
    expect(r.linhas[0]).toMatchObject({ previsto: 0, realizado: 80, diferenca: 80 });
    expect(r.realizadoSemPrevisto).toEqual({ quantidade: 1, total: 80 });
  });

  it("vencido = aberto com vencimento antes de hoje", () => {
    const r = resumirPrevistoRealizado(
      [l({ id: "4", status: "aberta", dataVencimento: "2026-09-09" }), l({ id: "5", status: "aberta", dataVencimento: "2026-09-10" })],
      "2026-09-10",
    );
    expect(r.vencidos.map((v) => v.id)).toEqual(["4"]);
    expect(r.linhas[0].vencidos).toBe(1);
  });

  it("soma em centavos: 0,1 + 0,2 = 0,3 exato", () => {
    const r = resumirPrevistoRealizado([l({ id: "6", valor: 0.1, status: "paga" }), l({ id: "7", valor: 0.2, status: "paga" })], "2026-09-10");
    expect(r.totais.realizado).toBe(0.3);
  });

  it("agrupa por categoria e ordena pela maior diferença absoluta", () => {
    const r = resumirPrevistoRealizado(
      [
        l({ id: "8", categoria: "A", valor: 10, status: "paga" }),
        l({ id: "9", categoria: "B", valor: 500, status: "aberta" }),
      ],
      "2026-09-10",
    );
    expect(r.linhas.map((x) => x.categoria)).toEqual(["B", "A"]);
  });
});
