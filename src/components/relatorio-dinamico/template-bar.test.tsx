// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { salvarMock, excluirMock } = vi.hoisted(() => ({ salvarMock: vi.fn(), excluirMock: vi.fn() }));
vi.mock("@/app/(app)/relatorios/dinamico/actions", () => ({ salvarTemplateAction: salvarMock, excluirTemplateAction: excluirMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { TemplateBar } from "./template-bar";
import { configPadrao } from "@/lib/relatorio-dinamico/tipos";

const tpl = { id: "11111111-1111-1111-1111-111111111111", nome: "Aluno cidade", config: configPadrao("aluno") };
const perms = { criar: true, editar: true, excluir: true };

beforeEach(() => { salvarMock.mockReset(); excluirMock.mockReset(); });

describe("TemplateBar", () => {
  it("Salvar sem template selecionado pede nome e cria", async () => {
    salvarMock.mockResolvedValue({ ok: true, template: { ...tpl, id: "22222222-2222-2222-2222-222222222222", nome: "Novo" } });
    const onSalvo = vi.fn();
    render(<ConfirmProvider><TemplateBar entidade="aluno" templates={[tpl]} selecionadoId={null} config={configPadrao("aluno")} permissoes={perms}
      onSelecionar={vi.fn()} onSalvo={onSalvo} onExcluido={vi.fn()} /></ConfirmProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    fireEvent.change(screen.getByLabelText("Nome do template"), { target: { value: "Novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar template" }));
    await waitFor(() => expect(salvarMock).toHaveBeenCalledWith({ entidade: "aluno", nome: "Novo", config: configPadrao("aluno") }));
    expect(onSalvo).toHaveBeenCalled();
  });
  it("Excluir pede confirmação pelo useConfirm (nunca confirm nativo)", async () => {
    const nativo = vi.spyOn(window, "confirm");
    excluirMock.mockResolvedValue({ ok: true });
    const onExcluido = vi.fn();
    render(<ConfirmProvider><TemplateBar entidade="aluno" templates={[tpl]} selecionadoId={tpl.id} config={tpl.config} permissoes={perms}
      onSelecionar={vi.fn()} onSalvo={vi.fn()} onExcluido={onExcluido} /></ConfirmProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Excluir/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir template" }));
    await waitFor(() => expect(onExcluido).toHaveBeenCalledWith(tpl.id));
    expect(nativo).not.toHaveBeenCalled();
  });
});
