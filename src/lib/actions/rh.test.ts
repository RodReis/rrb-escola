import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockUpload = vi.fn();
const mockRemove = vi.fn();
const mockRequirePermission = vi.fn().mockResolvedValue({
  profile: { escola_id: "escola-1" }
});

vi.mock("@/lib/auth/session", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args)
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    storage: { from: () => ({ upload: mockUpload, remove: mockRemove }) },
    from: () => ({ update: mockUpdate })
  })
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { uploadCompanyLogoAction } from "./rh";

describe("uploadCompanyLogoAction", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockUpdate.mockClear();
  });

  it("rejeita arquivo maior que 2MB antes de chamar o storage", async () => {
    const bigFile = new File([new Uint8Array(3 * 1024 * 1024)], "logo.png", { type: "image/png" });
    const fd = new FormData();
    fd.set("id", "company-1");
    fd.set("logo", bigFile);

    await expect(uploadCompanyLogoAction(fd)).rejects.toThrow("REDIRECT:/rh/empresas/company-1/editar?erro=arquivo_grande");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejeita extensao fora da lista permitida", async () => {
    const badFile = new File([new Uint8Array(10)], "logo.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.set("id", "company-1");
    fd.set("logo", badFile);

    await expect(uploadCompanyLogoAction(fd)).rejects.toThrow("REDIRECT:/rh/empresas/company-1/editar?erro=tipo_invalido");
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
