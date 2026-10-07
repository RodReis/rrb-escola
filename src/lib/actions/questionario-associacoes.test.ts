import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, formData } from "@/lib/questionario/test-support";

const h = vi.hoisted(() => ({
  client: null as unknown,
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requirePermission: h.requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.client }));

import {
  alternarAtivoAssociacaoAction,
  atualizarAssociacaoAction,
  criarAssociacoesAction,
} from "./questionario-associacoes";

const U = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const Q = U(1), P = U(2), T1 = U(3), T2 = U(4), ID = U(5), Q2 = U(6), T3 = U(7), P2 = U(8);

const questionarioAtivo = { "questionarios.select": [{ data: { id: Q, ativo: true } }] };
const turmasAtivas = {
  "turmas.select": [
    {
      data: [
        { id: T1, nome: "Matutino", ativo: true },
        { id: T2, nome: "Vespertino", ativo: true },
      ],
    },
  ],
};
const professorValido = { "employees.select": [{ data: { id: P } }] };

const lote = (extra: Record<string, string | string[]> = {}) =>
  formData({ questionarioId: Q, professorId: P, etapas: ["1", "2"], turmaIds: [T1, T2], ...extra });

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarAssociacoesAction", () => {
  it("cria todas as combinações etapa × turma numa única inserção, na escola do usuário", async () => {
    const db = fakeSupabase({
      ...questionarioAtivo,
      ...turmasAtivas,
      ...professorValido,
      "questionario_associacoes.select": [{ data: [] }],
    });
    h.client = db.client;

    const r = await criarAssociacoesAction(lote());

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.associacao", "create");
    expect(r).toEqual({ ok: true, message: "4 associações criadas." });
    const inserts = db.chamadas("questionario_associacoes", "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual([
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T1, etapa: 1 },
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T1, etapa: 2 },
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T2, etapa: 1 },
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T2, etapa: 2 },
    ]);
    expect(h.revalidatePath).toHaveBeenCalledWith("/questionario/associacoes");
  });

  it("ignora as combinações que já existem e informa quantas", async () => {
    const db = fakeSupabase({
      ...questionarioAtivo,
      ...turmasAtivas,
      ...professorValido,
      "questionario_associacoes.select": [{ data: [{ turma_id: T1, etapa: 1 }, { turma_id: T2, etapa: 2 }] }],
    });
    h.client = db.client;
    const r = await criarAssociacoesAction(lote());
    expect(r).toEqual({ ok: true, message: "2 associações criadas; 2 já existiam." });
    expect(db.chamadas("questionario_associacoes", "insert")[0].payload).toEqual([
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T1, etapa: 2 },
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T2, etapa: 1 },
    ]);
  });

  it("se todas já existem, não insere e avisa", async () => {
    const db = fakeSupabase({
      ...questionarioAtivo,
      ...turmasAtivas,
      ...professorValido,
      "questionario_associacoes.select": [
        { data: [{ turma_id: T1, etapa: 1 }, { turma_id: T1, etapa: 2 }, { turma_id: T2, etapa: 1 }, { turma_id: T2, etapa: 2 }] },
      ],
    });
    h.client = db.client;
    const r = await criarAssociacoesAction(lote());
    expect(r).toEqual({ ok: true, message: "Nenhuma associação nova: as 4 já existiam." });
    expect(db.chamadas("questionario_associacoes", "insert")).toHaveLength(0);
  });

  it("sem etapa ou sem turma: erro claro e banco intocado", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    expect(await criarAssociacoesAction(lote({ etapas: [] }))).toEqual({ ok: false, error: "Marque ao menos uma etapa" });
    expect(await criarAssociacoesAction(lote({ turmaIds: [] }))).toEqual({ ok: false, error: "Marque ao menos uma turma" });
    expect(db.calls).toHaveLength(0);
  });

  it("recusa questionário inexistente ou inativo", async () => {
    const inexistente = fakeSupabase({ "questionarios.select": [{ data: null }] });
    h.client = inexistente.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: "Questionário inválido." });

    const inativo = fakeSupabase({ "questionarios.select": [{ data: { id: Q, ativo: false } }] });
    h.client = inativo.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: "Questionário inativo." });
    expect(inativo.chamadas("questionario_associacoes", "insert")).toHaveLength(0);
  });

  it("recusa turma inexistente (ou de outra escola) e turma inativa", async () => {
    const faltando = fakeSupabase({ ...questionarioAtivo, "turmas.select": [{ data: [{ id: T1, nome: "Matutino", ativo: true }] }] });
    h.client = faltando.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: "Turma inválida." });

    const inativa = fakeSupabase({
      ...questionarioAtivo,
      "turmas.select": [{ data: [{ id: T1, nome: "Matutino", ativo: true }, { id: T2, nome: "Vespertino", ativo: false }] }],
    });
    h.client = inativa.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: 'A turma "Vespertino" está inativa.' });
    expect(inativa.chamadas("questionario_associacoes", "insert")).toHaveLength(0);
  });

  it("recusa professor que não é funcionário ativo de fund1/fund2/medio", async () => {
    const db = fakeSupabase({ ...questionarioAtivo, ...turmasAtivas, "employees.select": [{ data: null }] });
    h.client = db.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: "Professor inválido." });
    const filtros = db.chamadas("employees", "select")[0].filtros;
    expect(filtros).toContainEqual(["in", "school_category", ["fund1", "fund2", "medio"]]);
    expect(filtros).toContainEqual(["eq", "ativo", true]);
  });

  it("corrida: outra pessoa criou no meio (23505 no insert) devolve { ok: false } amigável", async () => {
    const db = fakeSupabase({
      ...questionarioAtivo,
      ...turmasAtivas,
      ...professorValido,
      "questionario_associacoes.select": [{ data: [] }],
      "questionario_associacoes.insert": [{ error: { message: "duplicate key", code: "23505" } }],
    });
    h.client = db.client;
    expect(await criarAssociacoesAction(lote())).toEqual({
      ok: false,
      error: "Alguma dessas associações acabou de ser criada por outra pessoa. Repita o cadastro.",
    });
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("repetidos na entrada (turma/etapa) não duplicam linhas", async () => {
    const db = fakeSupabase({
      ...questionarioAtivo,
      "turmas.select": [{ data: [{ id: T1, nome: "Matutino", ativo: true }] }],
      ...professorValido,
      "questionario_associacoes.select": [{ data: [] }],
    });
    h.client = db.client;
    await criarAssociacoesAction(lote({ etapas: ["1", "1"], turmaIds: [T1, T1] }));
    expect(db.chamadas("questionario_associacoes", "insert")[0].payload).toHaveLength(1);
  });
});

describe("atualizarAssociacaoAction", () => {
  const edicao = (extra: Record<string, string> = {}) =>
    formData({ id: ID, questionarioId: Q, turmaId: T1, professorId: P, etapa: "2", ...extra });
  const atual = { "questionario_associacoes.select": [{ data: { questionario_id: Q, turma_id: T1, professor_id: P } }] };

  it("atualiza os 4 campos da associação da escola", async () => {
    const db = fakeSupabase(atual);
    h.client = db.client;
    const r = await atualizarAssociacaoAction(edicao());
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.associacao", "update");
    expect(r).toMatchObject({ ok: true });
    const upd = db.chamadas("questionario_associacoes", "update")[0];
    expect(upd.payload).toEqual({ questionario_id: Q, turma_id: T1, professor_id: P, etapa: 2 });
    expect(upd.filtros).toContainEqual(["eq", "id", ID]);
    expect(upd.filtros).toContainEqual(["eq", "escola_id", "escola-1"]);
  });

  it("referências não trocadas não são revalidadas (continuam valendo mesmo inativas)", async () => {
    const db = fakeSupabase(atual);
    h.client = db.client;
    await atualizarAssociacaoAction(edicao({ etapa: "3" }));
    expect(db.chamadas("questionarios", "select")).toHaveLength(0);
    expect(db.chamadas("turmas", "select")).toHaveLength(0);
    expect(db.chamadas("employees", "select")).toHaveLength(0);
  });

  it("trocar para turma inativa, questionário inativo ou professor inválido é recusado antes de gravar", async () => {
    const turma = fakeSupabase({ ...atual, "turmas.select": [{ data: [{ id: T3, nome: "Noturno", ativo: false }] }] });
    h.client = turma.client;
    expect(await atualizarAssociacaoAction(edicao({ turmaId: T3 }))).toEqual({
      ok: false,
      error: 'A turma "Noturno" está inativa.',
    });
    expect(turma.chamadas("questionario_associacoes", "update")).toHaveLength(0);

    const quest = fakeSupabase({ ...atual, "questionarios.select": [{ data: { id: Q2, ativo: false } }] });
    h.client = quest.client;
    expect(await atualizarAssociacaoAction(edicao({ questionarioId: Q2 }))).toEqual({
      ok: false,
      error: "Questionário inativo.",
    });

    const prof = fakeSupabase({ ...atual, "employees.select": [{ data: null }] });
    h.client = prof.client;
    expect(await atualizarAssociacaoAction(edicao({ professorId: P2 }))).toEqual({
      ok: false,
      error: "Professor inválido.",
    });
  });

  it("edição que duplica outra associação devolve { ok: false } com mensagem amigável (não lança)", async () => {
    h.client = fakeSupabase({
      ...atual,
      "questionario_associacoes.update": [{ error: { message: "duplicate key", code: "23505" } }],
    }).client;
    expect(await atualizarAssociacaoAction(edicao())).toEqual({
      ok: false,
      error: "Esta associação já existe (mesmo questionário, turma, etapa e professor).",
    });
  });

  it("associação inexistente", async () => {
    h.client = fakeSupabase({ "questionario_associacoes.select": [{ data: null }] }).client;
    expect(await atualizarAssociacaoAction(edicao())).toEqual({ ok: false, error: "Associação não encontrada." });
  });

  it("recusa etapa inválida sem tocar no banco", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    expect((await atualizarAssociacaoAction(edicao({ etapa: "7" }))).ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("alternarAtivoAssociacaoAction", () => {
  it("inativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await alternarAtivoAssociacaoAction(formData({ id: ID, ativo: "false" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.associacao", "update");
    expect(db.chamadas("questionario_associacoes", "update")[0].payload).toEqual({ ativo: false });
    expect(db.chamadas("questionario_associacoes", "delete")).toHaveLength(0);
  });
});
