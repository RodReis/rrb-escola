// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeclaracaoModeloForm } from "./declaracao-modelo-form";

describe("DeclaracaoModeloForm", () => {
  it("insere o parâmetro escolhido no texto, na posição do cursor", () => {
    render(<DeclaracaoModeloForm action={vi.fn()} />);

    const textoInput = screen.getByLabelText(/^Texto$/i) as HTMLTextAreaElement;
    fireEvent.change(textoInput, { target: { value: "Aluno " } });
    textoInput.setSelectionRange(6, 6);

    fireEvent.click(screen.getByRole("button", { name: /adicionar parâmetro/i }));
    fireEvent.click(screen.getByRole("option", { name: /NOME_ALUNO/i }));

    expect(textoInput.value).toBe("Aluno [NOME_ALUNO]");
  });

  it("pré-preenche os campos quando editando um modelo existente", () => {
    render(
      <DeclaracaoModeloForm
        action={vi.fn()}
        modelo={{
          id: "1", codigo: 1, nome: "Declaração de Frequência", titulo: "DECLARAÇÃO",
          texto: "Aluno [NOME_ALUNO].", fecho: "F", ativo: true,
          created_at: null, updated_at: null
        }}
      />
    );

    expect(screen.getByDisplayValue("Declaração de Frequência")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DECLARAÇÃO")).toBeInTheDocument();
  });
});
