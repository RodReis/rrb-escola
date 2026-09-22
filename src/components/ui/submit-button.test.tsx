// @vitest-environment jsdom
/**
 * Prova que o SubmitButton bloqueia o segundo clique enquanto o form esta
 * enviando — o que `<form action={serverAction}>` com um <button> cru nao faz.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SubmitButton } from "./submit-button";

// useFormStatus so reporta pending dentro do runtime do React DOM; no ambiente
// de teste controlamos o valor para exercitar os dois estados do botao.
const status = { pending: false };
vi.mock("react-dom", async () => {
  const real = await vi.importActual<typeof import("react-dom")>("react-dom");
  return { ...real, useFormStatus: () => status };
});

describe("SubmitButton", () => {
  it("fica clicavel enquanto o form esta parado", () => {
    status.pending = false;
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <SubmitButton>Salvar</SubmitButton>
      </form>,
    );

    const botao = screen.getByRole("button", { name: "Salvar" });
    expect(botao).not.toBeDisabled();

    fireEvent.click(botao);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("desabilita e marca aria-busy enquanto o form esta enviando", () => {
    status.pending = true;
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <SubmitButton>Salvar</SubmitButton>
      </form>,
    );

    const botao = screen.getByRole("button", { name: "Salvar" });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");

    // O clique duplo que hoje gera cobranca/matricula duplicada:
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("respeita um disabled proprio do call site", () => {
    status.pending = false;
    render(
      <form>
        <SubmitButton disabled>Salvar chamada</SubmitButton>
      </form>,
    );
    expect(screen.getByRole("button", { name: "Salvar chamada" })).toBeDisabled();
  });
});
