import { describe, it, expect, vi, beforeEach } from "vitest";

const { createServerClientMock } = vi.hoisted(() => ({ createServerClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: createServerClientMock }));

import { carregarCtxAlunos, listarRegistrosAluno } from "./aluno";

/** Builder encadeável que resolve para { data, error } no último elo da cadeia. */
function chainable(data: unknown[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const registrar = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  builder.select = registrar("select");
  builder.eq = registrar("eq");
  builder.in = registrar("in");
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data, error: null });
  return { builder, calls };
}

const ALUNO_A = "aaaaaaaa-1111-1111-1111-111111111111";
const ALUNO_B = "bbbbbbbb-2222-2222-2222-222222222222";

beforeEach(() => {
  createServerClientMock.mockReset();
});

describe("carregarCtxAlunos", () => {
  it("filtra a query de matrículas pelo status informado", async () => {
    const { builder, calls } = chainable([]);
    const fromMock = vi.fn(() => builder);
    createServerClientMock.mockResolvedValue({ from: fromMock });

    await carregarCtxAlunos([ALUNO_A], 2026, new Set(), ["ativa"]);

    expect(fromMock).toHaveBeenCalledWith("matriculas");
    const chamadaStatus = calls.find((c) => c.method === "in" && c.args[0] === "status");
    expect(chamadaStatus?.args[1]).toEqual(["ativa"]);
  });

  it("deduplica matrículas do mesmo aluno preferindo a ativa", async () => {
    const linhaCancelada = {
      aluno_id: ALUNO_A, turma_id: "t1", codigo: "1", ano_letivo: 2026, status: "cancelada", data_matricula: null,
      series: { nome: "5º ano", segmento: "fund1" }, turmas: { nome: "5A", turno: "manha" },
      alunos: { nome: "Aluno A (cancelada)" },
    };
    const linhaAtiva = {
      aluno_id: ALUNO_A, turma_id: "t2", codigo: "2", ano_letivo: 2026, status: "ativa", data_matricula: null,
      series: { nome: "5º ano", segmento: "fund1" }, turmas: { nome: "5B", turno: "manha" },
      alunos: { nome: "Aluno A (ativa)" },
    };
    const linhaOutroAluno = {
      aluno_id: ALUNO_B, turma_id: "t3", codigo: "3", ano_letivo: 2026, status: "ativa", data_matricula: null,
      series: { nome: "5º ano", segmento: "fund1" }, turmas: { nome: "5B", turno: "manha" },
      alunos: { nome: "Aluno B" },
    };
    const { builder } = chainable([linhaCancelada, linhaAtiva, linhaOutroAluno]);
    createServerClientMock.mockResolvedValue({ from: vi.fn(() => builder) });

    const resultado = await carregarCtxAlunos([ALUNO_A, ALUNO_B], 2026, new Set(), ["ativa", "cancelada"]);

    expect(resultado).toHaveLength(2);
    const doAlunoA = resultado.find((r) => r.aluno.nome === "Aluno A (ativa)");
    expect(doAlunoA?.matricula.status).toBe("ativa");
  });
});

describe("listarRegistrosAluno", () => {
  it("deduplica o mesmo aluno quando dois status são marcados simultaneamente", async () => {
    const linhaCancelada = { aluno_id: ALUNO_A, status: "cancelada", alunos: { nome: "Aluno A" }, series: { nome: "5º ano", segmento: "fund1" }, turmas: { nome: "5A" } };
    const linhaAtiva = { aluno_id: ALUNO_A, status: "ativa", alunos: { nome: "Aluno A" }, series: { nome: "5º ano", segmento: "fund1" }, turmas: { nome: "5B" } };
    const { builder } = chainable([linhaCancelada, linhaAtiva]);
    createServerClientMock.mockResolvedValue({ from: vi.fn(() => builder) });

    const registros = await listarRegistrosAluno({ ano: 2026, filtrarPor: "serie", valores: [], status: ["ativa", "cancelada"] });

    expect(registros).toHaveLength(1);
    expect(registros[0].detalhe).toContain("5B");
  });
});
