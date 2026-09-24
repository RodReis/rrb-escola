import { describe, it, expect, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({ from: mockFrom })
}));

import { listarAlunosParaDeclaracao } from "./declaracao-emissao";

describe("listarAlunosParaDeclaracao", () => {
  it("inclui matrículas ativa, cancelada e transferida do ano filtrado", async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: [
        { id: "m1", aluno_id: "a1", alunos: { nome: "Ana" } },
        { id: "m2", aluno_id: "a2", alunos: { nome: "Bruno" } }
      ],
      error: null
    });
    const eqChain = { eq: vi.fn().mockReturnThis(), in: inFn };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(eqChain) });

    const resultado = await listarAlunosParaDeclaracao({ anoLetivo: 2026, serieId: "serie-1" });

    expect(inFn).toHaveBeenCalledWith("status", ["ativa", "cancelada", "transferida"]);
    expect(resultado).toEqual([
      { matriculaId: "m1", alunoId: "a1", nome: "Ana" },
      { matriculaId: "m2", alunoId: "a2", nome: "Bruno" }
    ]);
  });
});
