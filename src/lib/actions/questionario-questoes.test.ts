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
const ESC = "44444444-4444-4444-8444-444444444444";

const grupoAtivo = { "questao_grupos.select": [{ data: { id: GRUPO, ativo: true } }] };

const campos = (extra: Record<string, string | string[]> = {}) =>
  formData({ grupoId: GRUPO, tipo: "subjetiva", pergunta: "Como foi?", ativa: "on", ...extra });

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarQuestaoAction", () => {
  it("grava questão subjetiva com limite de caracteres", async () => {
    const db = fakeSupabase({ ...grupoAtivo, "questoes.insert": [{ data: { id: "q1" } }] });
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
      escala_id: null,
    });
  });

  it("única escolha grava as alternativas em ordem", async () => {
    const db = fakeSupabase({ ...grupoAtivo, "questoes.insert": [{ data: { id: "q1" } }] });
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
      ...grupoAtivo,
      "questoes.insert": [{ data: { id: "q1" } }],
      "questao_alternativas.insert": [{ error: { message: "boom" } }],
    });
    h.client = db.client;
    await expect(criarQuestaoAction(campos({ tipo: "objetiva_multipla", alternativas: ["A", "B"] }))).rejects.toThrow();
    expect(db.chamadas("questoes", "delete")[0].filtros).toContainEqual(["eq", "id", "q1"]);
  });
});

describe("escala padrão da questão", () => {
  const comEscala = (extra: Record<string, string | string[]> = {}) =>
    campos({ tipo: "objetiva_escala", escalaId: ESC, ...extra });

  it("grava a escala padrão em questão com escala", async () => {
    const db = fakeSupabase({
      ...grupoAtivo,
      "escalas.select": [{ data: { id: ESC, ativo: true } }],
      "questoes.insert": [{ data: { id: "q1" } }],
    });
    h.client = db.client;
    const r = await criarQuestaoAction(comEscala());
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questoes", "insert")[0].payload).toMatchObject({ tipo: "objetiva_escala", escala_id: ESC });
  });

  it("questão com escala sem escolher a escala é recusada sem tocar no banco", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarQuestaoAction(campos({ tipo: "objetiva_escala" }));
    expect(r).toEqual({ ok: false, error: "Escolha a escala da questão" });
    expect(db.calls).toHaveLength(0);
  });

  it("recusa escala inexistente (ou de outra escola) e escala inativa", async () => {
    const inexistente = fakeSupabase({ ...grupoAtivo, "escalas.select": [{ data: null }] });
    h.client = inexistente.client;
    expect(await criarQuestaoAction(comEscala())).toEqual({ ok: false, error: "Escala inválida." });
    expect(inexistente.chamadas("questoes", "insert")).toHaveLength(0);

    const inativa = fakeSupabase({ ...grupoAtivo, "escalas.select": [{ data: { id: ESC, ativo: false } }] });
    h.client = inativa.client;
    expect(await criarQuestaoAction(comEscala())).toEqual({ ok: false, error: "Escala inativa." });
    expect(inativa.chamadas("questoes", "insert")).toHaveLength(0);
  });

  it("tipo sem escala ignora a escala enviada e nem consulta o banco por ela", async () => {
    const db = fakeSupabase({ ...grupoAtivo, "questoes.insert": [{ data: { id: "q1" } }] });
    h.client = db.client;
    await criarQuestaoAction(campos({ tipo: "subjetiva", escalaId: ESC }));
    expect(db.chamadas("escalas", "select")).toHaveLength(0);
    expect(db.chamadas("questoes", "insert")[0].payload).toMatchObject({ escala_id: null });
  });

  it("ao editar, manter a escala atual (mesmo inativa) passa sem consultar", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "objetiva_escala", grupo_id: GRUPO, escala_id: ESC } }],
    });
    h.client = db.client;
    const r = await atualizarQuestaoAction(comEscala({ id: ID }));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("escalas", "select")).toHaveLength(0);
    expect(db.chamadas("questoes", "update")[0].payload).toMatchObject({ escala_id: ESC });
  });

  it("ao editar, trocar para escala inativa é recusado", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "objetiva_escala", grupo_id: GRUPO, escala_id: ESC } }],
      "escalas.select": [{ data: { id: "55555555-5555-4555-8555-555555555555", ativo: false } }],
    });
    h.client = db.client;
    const r = await atualizarQuestaoAction(comEscala({ id: ID, escalaId: "55555555-5555-4555-8555-555555555555" }));
    expect(r).toEqual({ ok: false, error: "Escala inativa." });
    expect(db.chamadas("questoes", "update")).toHaveLength(0);
  });
});

describe("grupo da questão", () => {
  it("recusa grupo inexistente (ou de outra escola) sem gravar", async () => {
    const db = fakeSupabase({ "questao_grupos.select": [{ data: null }] });
    h.client = db.client;
    const r = await criarQuestaoAction(campos());
    expect(r).toEqual({ ok: false, error: "Grupo inválido." });
    expect(db.chamadas("questoes", "insert")).toHaveLength(0);
  });

  it("recusa grupo inativo em questão nova", async () => {
    const db = fakeSupabase({ "questao_grupos.select": [{ data: { id: GRUPO, ativo: false } }] });
    h.client = db.client;
    const r = await criarQuestaoAction(campos());
    expect(r).toEqual({ ok: false, error: "Grupo inativo." });
    expect(db.chamadas("questoes", "insert")).toHaveLength(0);
  });

  it("ao editar, trocar para grupo inativo é recusado; manter o grupo atual (mesmo inativo) passa", async () => {
    const OUTRO = "33333333-3333-4333-8333-333333333333";
    const trocando = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva", grupo_id: OUTRO } }],
      "questao_grupos.select": [{ data: { id: GRUPO, ativo: false } }],
    });
    h.client = trocando.client;
    expect(await atualizarQuestaoAction(campos({ id: ID }))).toEqual({ ok: false, error: "Grupo inativo." });
    expect(trocando.chamadas("questoes", "update")).toHaveLength(0);

    const mantendo = fakeSupabase({ "questoes.select": [{ data: { tipo: "subjetiva", grupo_id: GRUPO } }] });
    h.client = mantendo.client;
    expect(await atualizarQuestaoAction(campos({ id: ID }))).toMatchObject({ ok: true });
  });
});

describe("atualizarQuestaoAction", () => {
  it("recusa trocar o tipo de questão já usada em questionário", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva", grupo_id: GRUPO } }],
      "questionario_questoes.select": [{ count: 2 }],
    });
    h.client = db.client;

    const r = await atualizarQuestaoAction(campos({ id: ID, tipo: "objetiva_escala", escalaId: ESC }));

    expect(r).toEqual({
      ok: false,
      error: "Questão em uso em questionário: não é possível trocar o tipo.",
    });
    expect(db.chamadas("questoes", "update")).toHaveLength(0);
    expect(db.chamadas("questao_alternativas", "insert")).toHaveLength(0);
  });

  it("permite editar o texto de questão em uso (tipo igual)", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva", grupo_id: GRUPO } }],
      "questionario_questoes.select": [{ count: 3 }],
    });
    h.client = db.client;
    const r = await atualizarQuestaoAction(campos({ id: ID, pergunta: "Novo texto" }));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questoes", "update")[0].payload).toMatchObject({ pergunta: "Novo texto", tipo: "subjetiva" });
  });

  it("permite trocar o tipo quando não está em uso e troca as alternativas", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva", grupo_id: GRUPO } }],
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
