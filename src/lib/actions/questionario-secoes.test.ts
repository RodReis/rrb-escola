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

import { alternarAtivoSecaoAction, atualizarSecaoAction, criarSecaoAction } from "./questionario-secoes";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarSecaoAction", () => {
  it("exige create no módulo da seção e grava na escola do usuário", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarSecaoAction(formData({ descricao: "  Expressão corporal ", permiteLancamentoColetivo: "on" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.secao", "create");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("ficha_secoes", "insert")[0].payload).toEqual({
      escola_id: "escola-1",
      descricao: "Expressão corporal",
      permite_lancamento_coletivo: true,
    });
    expect(h.revalidatePath).toHaveBeenCalledWith("/questionario/secoes");
  });

  it("sem o flag, grava lançamento coletivo = false", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await criarSecaoAction(formData({ descricao: "Registro" }));
    expect(db.chamadas("ficha_secoes", "insert")[0].payload).toMatchObject({ permite_lancamento_coletivo: false });
  });

  it("recusa descrição vazia sem tocar no banco", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarSecaoAction(formData({ descricao: "   " }));
    expect(r).toEqual({ ok: false, error: "Descrição é obrigatória" });
    expect(db.calls).toHaveLength(0);
  });

  it("descrição duplicada vira mensagem amigável", async () => {
    h.client = fakeSupabase({
      "ficha_secoes.insert": [{ error: { message: "duplicate key", code: "23505" } }],
    }).client;
    await expect(criarSecaoAction(formData({ descricao: "Registro" }))).rejects.toThrow(/Já existe um registro/);
  });
});

describe("atualizarSecaoAction", () => {
  it("atualiza descrição e flag só da seção da escola", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await atualizarSecaoAction(formData({ id: ID, descricao: "Novo", permiteLancamentoColetivo: "on" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.secao", "update");
    expect(r).toMatchObject({ ok: true });
    const upd = db.chamadas("ficha_secoes", "update")[0];
    expect(upd.payload).toEqual({ descricao: "Novo", permite_lancamento_coletivo: true });
    expect(upd.filtros).toContainEqual(["eq", "id", ID]);
    expect(upd.filtros).toContainEqual(["eq", "escola_id", "escola-1"]);
  });

  it("recusa id inválido", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    expect((await atualizarSecaoAction(formData({ id: "x", descricao: "Novo" }))).ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("alternarAtivoSecaoAction", () => {
  it("inativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await alternarAtivoSecaoAction(formData({ id: ID, ativo: "false" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.secao", "update");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("ficha_secoes", "update")[0].payload).toEqual({ ativo: false });
    expect(db.chamadas("ficha_secoes", "delete")).toHaveLength(0);
  });
});
