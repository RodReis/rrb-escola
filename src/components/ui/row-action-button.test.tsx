// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UserX } from "lucide-react";
import { RowActionButton } from "./row-action-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
const confirmFn = vi.fn();
vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => confirmFn,
}));

beforeEach(() => {
  vi.clearAllMocks();
  confirmFn.mockResolvedValue(true);
});

describe("RowActionButton", () => {
  it("expoe o label como aria-label e title", () => {
    render(
      <RowActionButton action={vi.fn()} icon={UserX} label="Desativar" />
    );
    const btn = screen.getByRole("button", { name: "Desativar" });
    expect(btn).toHaveAttribute("title", "Desativar");
  });

  it("chama a action com os args declarados", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(
      <RowActionButton
        action={action}
        args={{ perfilId: "abc" }}
        icon={UserX}
        label="Desativar"
      />
    );
    screen.getByRole("button").click();
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const fd = action.mock.calls[0][0] as FormData;
    expect(fd.get("perfilId")).toBe("abc");
  });

  it("pede confirmacao antes de executar quando confirm e passado", async () => {
    confirmFn.mockResolvedValue(false);
    const action = vi.fn();
    render(
      <RowActionButton
        action={action}
        icon={UserX}
        label="Desativar"
        confirm="Desativar este usuario?"
      />
    );
    screen.getByRole("button").click();
    await waitFor(() => expect(confirmFn).toHaveBeenCalledOnce());
    expect(action).not.toHaveBeenCalled();
  });
});
