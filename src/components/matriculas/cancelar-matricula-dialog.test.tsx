// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { cancelarMatriculaActionMock, useConfirmMock } = vi.hoisted(() => ({
  cancelarMatriculaActionMock: vi.fn(),
  useConfirmMock: vi.fn(),
}));

vi.mock("@/lib/actions/cancelamento", () => ({ cancelarMatriculaAction: cancelarMatriculaActionMock }));
vi.mock("@/components/ui/confirm-dialog", () => ({ useConfirm: () => useConfirmMock }));

import { CancelarMatriculaDialog } from "./cancelar-matricula-dialog";

function mockFetchCobrancas(comIsaac: boolean) {
  const rows = comIsaac
    ? [{ id: "c1", descricao: "Mensalidade", competencia: "2026-09", valorFinal: 500, dataVencimento: "2026-10-05", origem: "isaac", preSelecionada: false }]
    : [];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(rows) }));
}

beforeEach(() => {
  cancelarMatriculaActionMock.mockReset().mockResolvedValue({ ok: true });
  useConfirmMock.mockReset().mockResolvedValue(true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) }));
});

function renderDialog(props = {}) {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  render(
    <CancelarMatriculaDialog
      matriculaId="11111111-1111-1111-1111-111111111111"
      alunoId="22222222-2222-2222-2222-222222222222"
      alunoNome="Ana Souza"
      serieNome="5º Ano"
      turmaNome="A"
      anoLetivo={2026}
      open={true}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      {...props}
    />
  );
  return { onOpenChange, onSuccess };
}

describe("CancelarMatriculaDialog", () => {
  it("botao Confirmar comeca desabilitado sem os dois cientes marcados", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();
  });

  it("habilita Confirmar so depois de marcar os dois switches obrigatorios", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/coordenação está ciente/i));
    fireEvent.click(screen.getByLabelText(/diretoria está ciente/i));
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeEnabled();
  });

  it("nao mostra switch do isaac quando nao ha cobranca isaac", async () => {
    mockFetchCobrancas(false);
    renderDialog();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByLabelText(/cancelada também no isaac/i)).not.toBeInTheDocument();
  });

  it("mostra switch do isaac quando ha cobranca isaac", async () => {
    mockFetchCobrancas(true);
    renderDialog();
    expect(await screen.findByLabelText(/cancelada também no isaac/i)).toBeInTheDocument();
  });

  it("chama a action e so dispara onSuccess ao fechar o estado pos-sucesso", async () => {
    const { onOpenChange, onSuccess } = renderDialog();
    fireEvent.click(screen.getByLabelText(/coordenação está ciente/i));
    fireEvent.click(screen.getByLabelText(/diretoria está ciente/i));
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(cancelarMatriculaActionMock).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByText("Fechar"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("nao chama a action quando useConfirm resolve false", async () => {
    useConfirmMock.mockResolvedValue(false);
    renderDialog();
    fireEvent.click(screen.getByLabelText(/coordenação está ciente/i));
    fireEvent.click(screen.getByLabelText(/diretoria está ciente/i));
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(useConfirmMock).toHaveBeenCalled());
    expect(cancelarMatriculaActionMock).not.toHaveBeenCalled();
  });

  it("mostra link para emitir declaracao apos cancelar com sucesso", async () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/coordenação está ciente/i));
    fireEvent.click(screen.getByLabelText(/diretoria está ciente/i));
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(screen.getByRole("link", { name: /emitir declaração/i })).toBeInTheDocument());
  });
});
