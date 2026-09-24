// src/lib/actions/declaracoes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockRequirePermission = vi.fn().mockResolvedValue({ profile: { escola_id: "escola-1" } });

vi.mock("@/lib/auth/session", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args)
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    from: () => ({ insert: mockInsert, update: mockUpdate, delete: mockDelete })
  })
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); })
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createDeclaracaoModeloAction,
  updateDeclaracaoModeloAction,
  deleteDeclaracaoModeloAction
} from "./declaracoes";

describe("createDeclaracaoModeloAction", () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockRequirePermission.mockClear();
  });

  it("checa a permissao historico/create antes de inserir", async () => {
    const fd = new FormData();
    fd.set("nome", "Declaração de Frequência");
    fd.set("titulo", "DECLARAÇÃO");
    fd.set("texto", "Aluno [NOME_ALUNO].");
    fd.set("fecho", "F");

    await expect(createDeclaracaoModeloAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "create");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ escola_id: "escola-1", nome: "Declaração de Frequência" })
    );
  });

  it("rejeita parametro desconhecido antes de tocar o banco", async () => {
    const fd = new FormData();
    fd.set("nome", "Modelo Ruim");
    fd.set("titulo", "T");
    fd.set("texto", "Aluno [NOME_ALNO].");
    fd.set("fecho", "F");

    await expect(createDeclaracaoModeloAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("updateDeclaracaoModeloAction", () => {
  it("checa a permissao historico/update", async () => {
    const fd = new FormData();
    fd.set("id", "123e4567-e89b-12d3-a456-426614174000");
    fd.set("nome", "Declaração de Frequência");
    fd.set("titulo", "DECLARAÇÃO");
    fd.set("texto", "Aluno [NOME_ALUNO].");
    fd.set("fecho", "F");
    fd.set("ativo", "on");

    await expect(updateDeclaracaoModeloAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "update");
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("deleteDeclaracaoModeloAction", () => {
  it("checa a permissao historico/delete", async () => {
    const fd = new FormData();
    fd.set("id", "123e4567-e89b-12d3-a456-426614174000");

    await expect(deleteDeclaracaoModeloAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "delete");
    expect(mockDelete).toHaveBeenCalled();
  });
});
