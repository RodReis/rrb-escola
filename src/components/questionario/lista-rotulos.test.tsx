// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ListaRotulos } from "./lista-rotulos";

function Harness({ inicial }: { inicial: string[] }) {
  const [valores, setValores] = useState(inicial);
  return <ListaRotulos nome="opcoes" rotulo="Opção" valores={valores} onChange={setValores} />;
}

const valoresAtuais = () =>
  screen.getAllByRole("textbox").map((el) => (el as HTMLInputElement).value);

describe("ListaRotulos", () => {
  it("adiciona uma linha vazia", () => {
    render(<Harness inicial={["A"]} />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(valoresAtuais()).toEqual(["A", ""]);
  });

  it("edita, reordena e remove", () => {
    render(<Harness inicial={["A", "B", "C"]} />);
    fireEvent.change(screen.getByLabelText("Opção 1"), { target: { value: "AA" } });
    fireEvent.click(screen.getByRole("button", { name: "Descer Opção 1" }));
    expect(valoresAtuais()).toEqual(["B", "AA", "C"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover Opção 3" }));
    expect(valoresAtuais()).toEqual(["B", "AA"]);
  });

  it("desabilita subir no primeiro e descer no último", () => {
    render(<Harness inicial={["A", "B"]} />);
    expect(screen.getByRole("button", { name: "Subir Opção 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Opção 2" })).toBeDisabled();
  });

  it("usa o mesmo name em todos os inputs (formData.getAll)", () => {
    render(<Harness inicial={["A", "B"]} />);
    for (const el of screen.getAllByRole("textbox")) expect(el).toHaveAttribute("name", "opcoes");
  });
});
