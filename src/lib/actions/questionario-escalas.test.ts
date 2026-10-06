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

import { alternarAtivoEscalaAction, atualizarEscalaAction, criarEscalaAction } from "./questionario-escalas";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarEscalaAction", () => {
  it("grava a escala e as opções na ordem informada, ignorando linhas em branco", async () => {
    const db = fakeSupabase({ "escalas.insert": [{ data: { id: "e1" } }] });
    h.client = db.client;

    const r = await criarEscalaAction(
      formData({ descricao: "Desenvolvimento", opcoes: ["Não observado", "", "Em desenvolvimento", "Desenvolvido"] }),
    );

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.escala", "create");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("escalas", "insert")[0].payload).toEqual({ escola_id: "escola-1", descricao: "Desenvolvimento" });
    expect(db.chamadas("escala_opcoes", "insert")[0].payload).toEqual([
      { escala_id: "e1", rotulo: "Não observado", ordem: 1 },
      { escala_id: "e1", rotulo: "Em desenvolvimento", ordem: 2 },
      { escala_id: "e1", rotulo: "Desenvolvido", ordem: 3 },
    ]);
  });

  it("recusa escala com 1 opção sem tocar no banco", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarEscalaAction(formData({ descricao: "E", opcoes: ["Só uma", ""] }));
    expect(r).toEqual({ ok: false, error: "A escala precisa de ao menos 2 opções" });
    expect(db.calls).toHaveLength(0);
  });

  it("recusa opções repetidas (caixa/espaço)", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarEscalaAction(formData({ descricao: "E", opcoes: ["Sim", " sim"] }));
    expect(r.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });

  it("descrição duplicada vira mensagem amigável", async () => {
    h.client = fakeSupabase({ "escalas.insert": [{ error: { message: "dup", code: "23505" } }] }).client;
    await expect(criarEscalaAction(formData({ descricao: "E", opcoes: ["A", "B"] }))).rejects.toThrow(
      /Já existe um registro/,
    );
  });

  it("se as opções falham, apaga a escala recém-criada (sem órfã)", async () => {
    const db = fakeSupabase({
      "escalas.insert": [{ data: { id: "e1" } }],
      "escala_opcoes.insert": [{ error: { message: "boom" } }],
    });
    h.client = db.client;
    await expect(criarEscalaAction(formData({ descricao: "E", opcoes: ["A", "B"] }))).rejects.toThrow();
    const del = db.chamadas("escalas", "delete");
    expect(del).toHaveLength(1);
    expect(del[0].filtros).toContainEqual(["eq", "id", "e1"]);
  });
});

describe("atualizarEscalaAction", () => {
  it("atualiza a descrição e troca as opções (grava antes de apagar)", async () => {
    const db = fakeSupabase({ "escala_opcoes.select": [{ data: [{ id: "o1" }] }] });
    h.client = db.client;

    const r = await atualizarEscalaAction(formData({ id: ID, descricao: "Nova", opcoes: ["X", "Y"] }));

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.escala", "update");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("escalas", "update")[0].payload).toEqual({ descricao: "Nova" });
    expect(db.calls.filter((c) => c.table === "escala_opcoes").map((c) => c.op)).toEqual([
      "select",
      "insert",
      "delete",
    ]);
  });
});

describe("alternarAtivoEscalaAction", () => {
  it("ativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await alternarAtivoEscalaAction(formData({ id: ID, ativo: "true" }));
    expect(db.chamadas("escalas", "update")[0].payload).toEqual({ ativo: true });
    expect(db.chamadas("escalas", "delete")).toHaveLength(0);
  });
});
