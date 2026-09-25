// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/matriculas/cancelar-matricula-dialog", () => ({
  CancelarMatriculaDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="cancelar-dialog">dialog aberto</div> : null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AlunoRowActions } from "./aluno-row-actions";

function renderComponent(overrides: Partial<React.ComponentProps<typeof AlunoRowActions>> = {}) {
  render(
    <AlunoRowActions
      alunoId="aluno-1"
      alunoNome="Ana Souza"
      ativo={true}
      matriculaAtivaNoAno={true}
      matriculaId="matricula-1"
      serieNome="5º Ano"
      turmaNome="A"
      anoLetivo={2026}
      {...overrides}
    />
  );
}

describe("AlunoRowActions", () => {
  it("mostra icone de Cancelar matricula quando ha matricula ativa no ano", () => {
    renderComponent({ matriculaAtivaNoAno: true });
    expect(screen.getByLabelText(/cancelar matr[ií]cula/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^matricular$/i)).not.toBeInTheDocument();
  });

  it("mostra icone de Matricular quando nao ha matricula ativa no ano", () => {
    renderComponent({ matriculaAtivaNoAno: false });
    expect(screen.getByLabelText(/^matricular$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/cancelar matr[ií]cula/i)).not.toBeInTheDocument();
  });

  it("mostra icone de Matricular quando aluno inativo, mesmo com matriculaAtivaNoAno true", () => {
    renderComponent({ ativo: false, matriculaAtivaNoAno: true });
    expect(screen.getByLabelText(/^matricular$/i)).toBeInTheDocument();
  });

  it("link de Matricular aponta para /matriculas com aluno_id e ancora", () => {
    renderComponent({ matriculaAtivaNoAno: false });
    const link = screen.getByLabelText(/^matricular$/i) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/matriculas?aluno_id=aluno-1#nova-matricula");
  });

  it("clicar em Cancelar matricula abre o dialogo", () => {
    renderComponent({ matriculaAtivaNoAno: true });
    fireEvent.click(screen.getByLabelText(/cancelar matr[ií]cula/i));
    expect(screen.getByTestId("cancelar-dialog")).toBeInTheDocument();
  });

  it("Editar e Boletim continuam presentes independente da matricula", () => {
    renderComponent({ matriculaAtivaNoAno: true });
    expect(screen.getByLabelText("Editar")).toBeInTheDocument();
    expect(screen.getByLabelText("Boletim")).toBeInTheDocument();
  });

  it("mostra icone de Emitir declaração apontando para a tela de emissao com o aluno pre-selecionado", () => {
    renderComponent();
    const link = screen.getByLabelText("Emitir declaração") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/declaracoes/emitir?aluno=aluno-1");
  });
});
