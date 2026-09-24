import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermissionMock, rpcMock, revalidatePathMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  rpcMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requirePermission: requirePermissionMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { cancelarMatriculaAction } from "./cancelamento";

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    matriculaId: "11111111-1111-1111-1111-111111111111",
    alunoId: "22222222-2222-2222-2222-222222222222",
    data: "2026-09-24",
    motivo: "transferencia",
    obs: "",
    cienteCoordenacao: "on",
    cienteDiretoria: "on",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  requirePermissionMock.mockReset().mockResolvedValue({ profile: { id: "perfil-1", escola_id: "escola-1" } });
  rpcMock.mockReset();
  revalidatePathMock.mockReset();
});

describe("cancelarMatriculaAction", () => {
  it("chama a RPC com os campos mapeados e revalida as rotas", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await cancelarMatriculaAction(buildFormData());

    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("cancelar_matricula", expect.objectContaining({
      p_matricula_id: "11111111-1111-1111-1111-111111111111",
      p_motivo: "transferencia",
      p_ciente_coordenacao: true,
      p_ciente_diretoria: true,
    }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/matriculas");
    expect(revalidatePathMock).toHaveBeenCalledWith("/alunos/22222222-2222-2222-2222-222222222222");
  });

  it("recusa sem ciencia da coordenacao antes de chamar a RPC", async () => {
    const result = await cancelarMatriculaAction(buildFormData({ cienteCoordenacao: "" }));

    expect(result.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("recusa motivo outro sem observacao antes de chamar a RPC", async () => {
    const result = await cancelarMatriculaAction(buildFormData({ motivo: "outro", obs: "" }));

    expect(result.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("repassa o error retornado pela RPC", async () => {
    rpcMock.mockResolvedValue({ data: { ok: false, error: "Matrícula não está ativa." }, error: null });

    const result = await cancelarMatriculaAction(buildFormData());

    expect(result).toEqual({ ok: false, error: "Matrícula não está ativa." });
  });

  it("mapeia isaacCanceladoConfirmado ausente para null (nao aplicavel)", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
    await cancelarMatriculaAction(buildFormData());
    expect(rpcMock).toHaveBeenCalledWith("cancelar_matricula", expect.objectContaining({
      p_isaac_cancelado_confirmado: null,
    }));
  });

  it("mapeia isaacCanceladoConfirmado='on' para true", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
    await cancelarMatriculaAction(buildFormData({ isaacCanceladoConfirmado: "on" }));
    expect(rpcMock).toHaveBeenCalledWith("cancelar_matricula", expect.objectContaining({
      p_isaac_cancelado_confirmado: true,
    }));
  });

  it("mapeia isaacCanceladoConfirmado='off' (switch desmarcado, mas presente) para false", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
    await cancelarMatriculaAction(buildFormData({ isaacCanceladoConfirmado: "off" }));
    expect(rpcMock).toHaveBeenCalledWith("cancelar_matricula", expect.objectContaining({
      p_isaac_cancelado_confirmado: false,
    }));
  });

  it("repassa o error de matricula nao encontrada / cross-tenant vindo da RPC", async () => {
    rpcMock.mockResolvedValue({ data: { ok: false, error: "Matrícula não encontrada." }, error: null });

    const result = await cancelarMatriculaAction(
      buildFormData({ matriculaId: "99999999-9999-9999-9999-999999999999" })
    );

    expect(result).toEqual({ ok: false, error: "Matrícula não encontrada." });
    expect(rpcMock).toHaveBeenCalledWith("cancelar_matricula", expect.objectContaining({
      p_matricula_id: "99999999-9999-9999-9999-999999999999",
    }));
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
