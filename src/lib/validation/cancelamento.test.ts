import { describe, it, expect } from "vitest";
import { CancelamentoMatriculaSchema } from "./cancelamento";

describe("CancelamentoMatriculaSchema", () => {
  const base = {
    matriculaId: "11111111-1111-1111-1111-111111111111",
    data: "2026-09-24",
    motivo: "transferencia" as const,
    obs: "",
    cienteCoordenacao: true,
    cienteDiretoria: true,
    isaacCanceladoConfirmado: null,
    cobrancaIds: [],
  };

  it("aceita motivo transferencia sem observacao", () => {
    expect(CancelamentoMatriculaSchema.safeParse(base).success).toBe(true);
  });

  it("recusa motivo outro sem observacao", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, motivo: "outro", obs: "" });
    expect(result.success).toBe(false);
  });

  it("aceita motivo outro com observacao preenchida", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, motivo: "outro", obs: "Pedido da família por escrito." });
    expect(result.success).toBe(true);
  });

  it("recusa sem ciencia da coordenacao", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, cienteCoordenacao: false });
    expect(result.success).toBe(false);
  });

  it("recusa sem ciencia da diretoria", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, cienteDiretoria: false });
    expect(result.success).toBe(false);
  });

  it("recusa motivo fora da lista fechada", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, motivo: "capricho" });
    expect(result.success).toBe(false);
  });
});
