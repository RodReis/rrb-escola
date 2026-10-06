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
  alternarAtivoQuestionarioAction,
  atualizarQuestionarioAction,
  clonarQuestionarioAction,
  criarQuestionarioAction,
} from "./questionario-questionarios";

const U = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const Q1 = U(1), Q2 = U(2), Q3 = U(3), E1 = U(4), QQ = U(5), V1 = U(6), V2 = U(7);

const questoes = {
  "questoes.select": [
    {
      data: [
        { id: Q1, tipo: "subjetiva", pergunta: "P1", ativa: true },
        { id: Q2, tipo: "objetiva_escala", pergunta: "P2", ativa: true },
      ],
    },
  ],
};

const form = (vinculos: unknown, extra: Record<string, string> = {}) =>
  formData({ descricao: "Quadro Infantil 3", observacoes: "", ativo: "on", vinculos: JSON.stringify(vinculos), ...extra });

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarQuestionarioAction", () => {
  it("grava questionário e vínculos numerados, escala só na questão de escala", async () => {
    const db = fakeSupabase({ ...questoes, "questionarios.insert": [{ data: { id: QQ } }] });
    h.client = db.client;

    const r = await criarQuestionarioAction(
      form([{ questaoId: Q1, escalaId: E1 }, { questaoId: Q2, escalaId: E1 }]),
    );

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questionario", "create");
    expect(r).toEqual({
      ok: true,
      message: "Questionário cadastrado.",
      redirectTo: "/questionario/questionarios",
    });
    expect(db.chamadas("questionarios", "insert")[0].payload).toEqual({
      escola_id: "escola-1", descricao: "Quadro Infantil 3", observacoes: null, ativo: true,
    });
    expect(db.chamadas("questionario_questoes", "insert")[0].payload).toEqual([
      { questionario_id: QQ, questao_id: Q1, escala_id: null, ordem: 1 },
      { questionario_id: QQ, questao_id: Q2, escala_id: E1, ordem: 2 },
    ]);
  });

  it("recusa questão com escala sem escala escolhida, sem gravar nada", async () => {
    const db = fakeSupabase(questoes);
    h.client = db.client;
    const r = await criarQuestionarioAction(form([{ questaoId: Q2, escalaId: null }]));
    expect(r).toEqual({ ok: false, error: 'Escolha a escala da questão "P2".' });
    expect(db.chamadas("questionarios", "insert")).toHaveLength(0);
  });

  it("recusa questão inativa em novo vínculo", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: [{ id: Q1, tipo: "subjetiva", pergunta: "P1", ativa: false }] }],
    });
    h.client = db.client;
    const r = await criarQuestionarioAction(form([{ questaoId: Q1, escalaId: null }]));
    expect(r).toEqual({ ok: false, error: 'A questão "P1" está inativa.' });
    expect(db.chamadas("questionarios", "insert")).toHaveLength(0);
  });

  it("recusa JSON de vínculos quebrado", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarQuestionarioAction(form([], { vinculos: "{nao-json" }));
    expect(r).toEqual({ ok: false, error: "Lista de questões inválida." });
    expect(db.calls).toHaveLength(0);
  });

  it("aceita questionário sem questões (rascunho)", async () => {
    const db = fakeSupabase({ "questionarios.insert": [{ data: { id: QQ } }] });
    h.client = db.client;
    const r = await criarQuestionarioAction(form([]));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questionario_questoes", "insert")).toHaveLength(0);
  });

  it("se os vínculos falham, apaga o questionário recém-criado (sem órfão)", async () => {
    const db = fakeSupabase({
      ...questoes,
      "questionarios.insert": [{ data: { id: QQ } }],
      "questionario_questoes.insert": [{ error: { message: "boom" } }],
    });
    h.client = db.client;
    await expect(criarQuestionarioAction(form([{ questaoId: Q1, escalaId: null }]))).rejects.toThrow();
    expect(db.chamadas("questionarios", "delete")[0].filtros).toContainEqual(["eq", "id", QQ]);
  });
});

describe("atualizarQuestionarioAction", () => {
  it("remove, atualiza (upsert por id) e insere — nessa ordem, preservando ids existentes", async () => {
    const db = fakeSupabase({
      "questoes.select": [
        {
          data: [
            { id: Q1, tipo: "subjetiva", pergunta: "P1", ativa: true },
            { id: Q3, tipo: "subjetiva", pergunta: "P3", ativa: true },
          ],
        },
      ],
      "questionario_questoes.select": [
        { data: [{ id: V1, questao_id: Q1 }, { id: V2, questao_id: Q2 }] },
      ],
    });
    h.client = db.client;

    const r = await atualizarQuestionarioAction(
      form([{ id: V1, questaoId: Q1, escalaId: null }, { questaoId: Q3, escalaId: null }], { id: QQ }),
    );

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questionario", "update");
    expect(r).toMatchObject({ ok: true, redirectTo: "/questionario/questionarios" });
    expect(db.calls.filter((c) => c.table === "questionario_questoes").map((c) => c.op)).toEqual([
      "select", "delete", "upsert", "insert",
    ]);
    expect(db.chamadas("questionario_questoes", "delete")[0].filtros).toContainEqual(["in", "id", [V2]]);
    expect(db.chamadas("questionario_questoes", "upsert")[0].payload).toEqual([
      { id: V1, questionario_id: QQ, questao_id: Q1, escala_id: null, ordem: 1 },
    ]);
    expect(db.chamadas("questionario_questoes", "insert")[0].payload).toEqual([
      { questionario_id: QQ, questao_id: Q3, escala_id: null, ordem: 2 },
    ]);
  });

  it("vínculo antigo com questão inativa continua salvando", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: [{ id: Q1, tipo: "subjetiva", pergunta: "P1", ativa: false }] }],
      "questionario_questoes.select": [{ data: [{ id: V1, questao_id: Q1 }] }],
    });
    h.client = db.client;
    const r = await atualizarQuestionarioAction(form([{ id: V1, questaoId: Q1, escalaId: null }], { id: QQ }));
    expect(r).toMatchObject({ ok: true });
  });

  it("questão inativa em NOVO vínculo é recusada antes de gravar", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: [{ id: Q3, tipo: "subjetiva", pergunta: "P3", ativa: false }] }],
      "questionario_questoes.select": [{ data: [] }],
    });
    h.client = db.client;
    const r = await atualizarQuestionarioAction(form([{ questaoId: Q3, escalaId: null }], { id: QQ }));
    expect(r).toEqual({ ok: false, error: 'A questão "P3" está inativa.' });
    expect(db.chamadas("questionarios", "update")).toHaveLength(0);
    expect(db.chamadas("questionario_questoes", "insert")).toHaveLength(0);
  });
});

describe("alternarAtivoQuestionarioAction", () => {
  it("inativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await alternarAtivoQuestionarioAction(formData({ id: QQ, ativo: "false" }));
    expect(db.chamadas("questionarios", "update")[0].payload).toEqual({ ativo: false });
    expect(db.chamadas("questionarios", "delete")).toHaveLength(0);
  });
});

describe("clonarQuestionarioAction", () => {
  const origem = {
    "questionarios.select": [{ data: { descricao: "Infantil 3", observacoes: "obs" } }],
    "questionario_questoes.select": [
      { data: [{ questao_id: Q2, escala_id: E1, ordem: 2 }, { questao_id: Q1, escala_id: null, ordem: 1 }] },
    ],
    "questionarios.insert": [{ data: { id: QQ } }],
  };

  it("cria cópia inativa com os vínculos e manda abrir a edição", async () => {
    const db = fakeSupabase(origem);
    h.client = db.client;

    const r = await clonarQuestionarioAction(formData({ id: V1 }));

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questionario", "create");
    expect(r).toMatchObject({ ok: true, redirectTo: `/questionario/questionarios/${QQ}/editar` });
    expect(db.chamadas("questionarios", "insert")[0].payload).toEqual({
      escola_id: "escola-1", descricao: "Infantil 3 (cópia)", observacoes: "obs", ativo: false,
    });
    expect(db.chamadas("questionario_questoes", "insert")[0].payload).toEqual([
      { questionario_id: QQ, questao_id: Q1, escala_id: null, ordem: 1 },
      { questionario_id: QQ, questao_id: Q2, escala_id: E1, ordem: 2 },
    ]);
  });

  it("clona questionário vazio sem inserir vínculos", async () => {
    const db = fakeSupabase({ ...origem, "questionario_questoes.select": [{ data: [] }] });
    h.client = db.client;
    const r = await clonarQuestionarioAction(formData({ id: V1 }));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questionario_questoes", "insert")).toHaveLength(0);
  });

  it("origem inexistente", async () => {
    h.client = fakeSupabase({ "questionarios.select": [{ data: null }] }).client;
    const r = await clonarQuestionarioAction(formData({ id: V1 }));
    expect(r).toEqual({ ok: false, error: "Questionário não encontrado." });
  });

  it("se os vínculos da cópia falham, apaga a cópia (sem órfã)", async () => {
    const db = fakeSupabase({ ...origem, "questionario_questoes.insert": [{ error: { message: "boom" } }] });
    h.client = db.client;
    await expect(clonarQuestionarioAction(formData({ id: V1 }))).rejects.toThrow();
    expect(db.chamadas("questionarios", "delete")[0].filtros).toContainEqual(["eq", "id", QQ]);
  });
});
