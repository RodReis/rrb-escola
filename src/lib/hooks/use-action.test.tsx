// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAction } from "./use-action";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}));

const confirmFn = vi.fn();
vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => confirmFn,
}));

function Harness({
  action,
  opts,
}: {
  action: (...a: unknown[]) => unknown;
  opts?: Parameters<typeof useAction>[1];
}) {
  const { run, pending } = useAction(action, opts);
  return (
    <button onClick={() => run()} data-pending={pending}>
      Executar
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  confirmFn.mockResolvedValue(true);
});

describe("useAction", () => {
  it("chama a action e mostra toast de sucesso", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(<Harness action={action} opts={{ success: "Salvo." }} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Salvo."));
  });

  it("mostra toast de erro quando a action devolve ok:false", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "CPF invalido." });
    render(<Harness action={action} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("CPF invalido."));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("nao chama a action quando a confirmacao e cancelada", async () => {
    confirmFn.mockResolvedValue(false);
    const action = vi.fn();
    render(<Harness action={action} opts={{ confirm: "Tem certeza?" }} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(confirmFn).toHaveBeenCalledOnce());
    expect(action).not.toHaveBeenCalled();
  });

  it("navega quando a action devolve redirectTo", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: true, data: undefined, redirectTo: "/alunos" });
    render(<Harness action={action} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/alunos"));
  });

  it("chama refresh quando a action retorna void", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<Harness action={action} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("nao mostra toast de erro quando a action redireciona", async () => {
    const action = vi.fn().mockRejectedValue(
      Object.assign(new Error("NEXT_REDIRECT"), {
        digest: "NEXT_REDIRECT;push;/alunos;307;",
      })
    );
    render(<Harness action={action} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(toastError).not.toHaveBeenCalled();
  });

  it("chama onSuccess apos sucesso", async () => {
    const onSuccess = vi.fn();
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(<Harness action={action} opts={{ onSuccess }} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it("passa o data do ActionResult para onSuccess", async () => {
    const onSuccess = vi.fn();
    const action = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { senha: "abc123" } });
    render(<Harness action={action} opts={{ onSuccess }} />);
    screen.getByRole("button").click();
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({ senha: "abc123" })
    );
  });

  it("nao mostra toast de sucesso quando silent e true", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(<Harness action={action} opts={{ silent: true }} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("mostra toast de erro mesmo com silent true", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "Falhou." });
    render(<Harness action={action} opts={{ silent: true }} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Falhou."));
  });
});
