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

import { alternarAtivoGrupoAction, atualizarGrupoAction, criarGrupoAction } from "./questionario-grupos";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarGrupoAction", () => {
  it("exige create no módulo do grupo e grava na escola do usuário", async () => {
    const db = fakeSupabase();
    h.client = db.client;

    const r = await criarGrupoAction(formData({ descricao: "  Corpo, gestos  " }));

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.grupo", "create");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questao_grupos", "insert")[0].payload).toEqual({
      escola_id: "escola-1",
      descricao: "Corpo, gestos",
    });
    expect(h.revalidatePath).toHaveBeenCalledWith("/questionario/grupos");
  });

  it("recusa descrição vazia sem tocar no banco", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarGrupoAction(formData({ descricao: "   " }));
    expect(r).toEqual({ ok: false, error: "Descrição é obrigatória" });
    expect(db.calls).toHaveLength(0);
  });

  it("descrição duplicada vira mensagem amigável", async () => {
    h.client = fakeSupabase({
      "questao_grupos.insert": [{ error: { message: "duplicate key", code: "23505" } }],
    }).client;
    await expect(criarGrupoAction(formData({ descricao: "Corpo" }))).rejects.toThrow(/Já existe um registro/);
  });
});

describe("atualizarGrupoAction", () => {
  it("atualiza só a descrição do grupo da escola", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await atualizarGrupoAction(formData({ id: ID, descricao: "Novo" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.grupo", "update");
    expect(r).toMatchObject({ ok: true });
    const upd = db.chamadas("questao_grupos", "update")[0];
    expect(upd.payload).toEqual({ descricao: "Novo" });
    expect(upd.filtros).toContainEqual(["eq", "id", ID]);
    expect(upd.filtros).toContainEqual(["eq", "escola_id", "escola-1"]);
  });

  it("recusa id inválido", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await atualizarGrupoAction(formData({ id: "x", descricao: "Novo" }));
    expect(r.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("alternarAtivoGrupoAction", () => {
  it("inativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await alternarAtivoGrupoAction(formData({ id: ID, ativo: "false" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.grupo", "update");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questao_grupos", "update")[0].payload).toEqual({ ativo: false });
    expect(db.chamadas("questao_grupos", "delete")).toHaveLength(0);
  });
});
