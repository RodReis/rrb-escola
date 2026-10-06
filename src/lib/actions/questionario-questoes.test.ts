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

import { alternarAtivoQuestaoAction, atualizarQuestaoAction, criarQuestaoAction } from "./questionario-questoes";

const ID = "11111111-1111-4111-8111-111111111111";
const GRUPO = "22222222-2222-4222-8222-222222222222";

const campos = (extra: Record<string, string | string[]> = {}) =>
  formData({ grupoId: GRUPO, tipo: "subjetiva", pergunta: "Como foi?", ativa: "on", ...extra });

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarQuestaoAction", () => {
  it("grava questão subjetiva com limite de caracteres", async () => {
    const db = fakeSupabase({ "questoes.insert": [{ data: { id: "q1" } }] });
    h.client = db.client;

    const r = await criarQuestaoAction(
      campos({ limitarCaracteres: "on", qtdeCaracteres: "300", qtdeLinhas: "5", obrigatoria: "on" }),
    );

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questao", "create");
    expect(r).toEqual({ ok: true, message: "Questão cadastrada.", redirectTo: "/questionario/questoes" });
    expect(db.chamadas("questoes", "insert")[0].payload).toEqual({
      escola_id: "escola-1",
      grupo_id: GRUPO,
      tipo: "subjetiva",
      pergunta: "Como foi?",
      ativa: true,
      obrigatoria: true,
      limitar_caracteres: true,
      qtde_caracteres: 300,
      qtde_linhas: 5,
    });
  });

  it("única escolha grava as alternativas em ordem", async () => {
    const db = fakeSupabase({ "questoes.insert": [{ data: { id: "q1" } }] });
    h.client = db.client;
    await criarQuestaoAction(campos({ tipo: "objetiva_unica", alternativas: ["Sim", "", "Não"] }));
    expect(db.chamadas("questao_alternativas", "insert")[0].payload).toEqual([
      { questao_id: "q1", rotulo: "Sim", ordem: 1 },
      { questao_id: "q1", rotulo: "Não", ordem: 2 },
    ]);
  });

  it("única escolha com 1 alternativa é recusada sem gravar nada", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarQuestaoAction(campos({ tipo: "objetiva_unica", alternativas: ["Só uma"] }));
    expect(r).toEqual({ ok: false, error: "A questão precisa de ao menos 2 alternativas" });
    expect(db.calls).toHaveLength(0);
  });

  it("se as alternativas falham, apaga a questão recém-criada (sem órfã)", async () => {
    const db = fakeSupabase({
      "questoes.insert": [{ data: { id: "q1" } }],
      "questao_alternativas.insert": [{ error: { message: "boom" } }],
    });
    h.client = db.client;
    await expect(criarQuestaoAction(campos({ tipo: "objetiva_multipla", alternativas: ["A", "B"] }))).rejects.toThrow();
    expect(db.chamadas("questoes", "delete")[0].filtros).toContainEqual(["eq", "id", "q1"]);
  });
});

describe("atualizarQuestaoAction", () => {
  it("recusa trocar o tipo de questão já usada em questionário", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva" } }],
      "questionario_questoes.select": [{ count: 2 }],
    });
    h.client = db.client;

    const r = await atualizarQuestaoAction(campos({ id: ID, tipo: "objetiva_escala" }));

    expect(r).toEqual({
      ok: false,
      error: "Questão em uso em questionário: não é possível trocar o tipo.",
    });
    expect(db.chamadas("questoes", "update")).toHaveLength(0);
    expect(db.chamadas("questao_alternativas", "insert")).toHaveLength(0);
  });

  it("permite editar o texto de questão em uso (tipo igual)", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva" } }],
      "questionario_questoes.select": [{ count: 3 }],
    });
    h.client = db.client;
    const r = await atualizarQuestaoAction(campos({ id: ID, pergunta: "Novo texto" }));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questoes", "update")[0].payload).toMatchObject({ pergunta: "Novo texto", tipo: "subjetiva" });
  });

  it("permite trocar o tipo quando não está em uso e troca as alternativas", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva" } }],
      "questionario_questoes.select": [{ count: 0 }],
      "questao_alternativas.select": [{ data: [] }],
    });
    h.client = db.client;
    const r = await atualizarQuestaoAction(campos({ id: ID, tipo: "objetiva_unica", alternativas: ["A", "B"] }));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questoes", "update")[0].payload).toMatchObject({ tipo: "objetiva_unica" });
    expect(db.chamadas("questao_alternativas", "insert")).toHaveLength(1);
  });

  it("questão inexistente", async () => {
    h.client = fakeSupabase({ "questoes.select": [{ data: null }] }).client;
    const r = await atualizarQuestaoAction(campos({ id: ID }));
    expect(r).toEqual({ ok: false, error: "Questão não encontrada." });
  });
});

describe("alternarAtivoQuestaoAction", () => {
  it("usa a coluna `ativa` e não apaga", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await alternarAtivoQuestaoAction(formData({ id: ID, ativo: "false" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questao", "update");
    expect(db.chamadas("questoes", "update")[0].payload).toEqual({ ativa: false });
    expect(db.chamadas("questoes", "delete")).toHaveLength(0);
  });
});
