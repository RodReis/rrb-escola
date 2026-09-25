// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Stepper } from "./stepper";
import { Segmentado } from "./segmentado";
import { OrdenacaoEditor } from "./ordenacao-editor";

describe("Stepper", () => {
  it("respeita passo e limites", () => {
    const onChange = vi.fn();
    render(<Stepper value={7.5} onChange={onChange} min={6} max={12} step={0.5} ariaLabel="Fonte" decimais={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Fonte" }));
    expect(onChange).toHaveBeenLastCalledWith(8);
    fireEvent.change(screen.getByLabelText("Fonte"), { target: { value: "99" } });
    expect(onChange).toHaveBeenLastCalledWith(12);
  });
});

describe("Segmentado", () => {
  it("alterna Sim/Não", () => {
    const onChange = vi.fn();
    render(<Segmentado value={true} onChange={onChange} ariaLabel="Rótulos" />);
    expect(screen.getByRole("radio", { name: "Sim" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Não" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe("OrdenacaoEditor", () => {
  const colunas = [
    { key: "a", label: "Nome", grupo: "g", tipo: "texto" as const },
    { key: "b", label: "Série", grupo: "g", tipo: "texto" as const },
  ];
  it("adiciona, inverte direção e remove", () => {
    const onChange = vi.fn();
    const { rerender } = render(<OrdenacaoEditor colunas={colunas} valor={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Coluna para ordenar"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ordenação" }));
    expect(onChange).toHaveBeenLastCalledWith([{ key: "b", dir: "asc" }]);
    rerender(<OrdenacaoEditor colunas={colunas} valor={[{ key: "b", dir: "asc" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Série: crescente" }));
    expect(onChange).toHaveBeenLastCalledWith([{ key: "b", dir: "desc" }]);
    fireEvent.click(screen.getByRole("button", { name: "Remover Série" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
