import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock das dependências server-side antes de importar a action.
const requirePermission = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requirePermission: () => requirePermission() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { exportarAnamneseDocxAction } from "./anamnese-export";

describe("exportarAnamneseDocxAction — RBAC", () => {
  beforeEach(() => {
    requirePermission.mockReset();
  });

  it("barra usuário sem pipeline_sensivel (requirePermission lança)", async () => {
    requirePermission.mockRejectedValueOnce(new Error("acesso negado"));
    const res = await exportarAnamneseDocxAction({ cardId: "c1" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/permiss/i);
    }
  });

  it("rejeita referência sem cardId nem alunoId", async () => {
    requirePermission.mockResolvedValueOnce({ profile: { id: "u1", escola_id: "e1" } });
    const res = await exportarAnamneseDocxAction({});
    expect(res.success).toBe(false);
  });
});
