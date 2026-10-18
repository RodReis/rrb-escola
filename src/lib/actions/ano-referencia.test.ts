import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  client: null as unknown,
  requirePermission: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn()
}));
vi.mock("@/lib/auth/session", () => ({ requirePermission: h.requirePermission }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.client }));

import { avancarAnoReferenciaAction } from "./ano-referencia";

describe("avancarAnoReferenciaAction", () => {
  beforeEach(() => {
    h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
    h.redirect.mockReset();
    h.revalidatePath.mockReset();
  });

  it("checa a permissão configuracoes.escola:update antes de gravar", async () => {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    h.client = { from: () => ({ update, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ano_referencia_atual: 2026 }, error: null }) }) }) }) };

    await avancarAnoReferenciaAction();

    expect(h.requirePermission).toHaveBeenCalledWith("configuracoes.escola", "update");
  });

  it("propaga erro de permissão sem tocar no banco", async () => {
    h.requirePermission.mockRejectedValue(new Error("sem acesso"));
    const update = vi.fn();
    h.client = { from: () => ({ update }) };

    await expect(avancarAnoReferenciaAction()).rejects.toThrow("sem acesso");
    expect(update).not.toHaveBeenCalled();
  });
});
