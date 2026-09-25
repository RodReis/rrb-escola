// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FiltrosRhForm } from "./filtros-rh";

const opcoes = {
  empresas: [{ id: "11111111-1111-1111-1111-111111111111", nome: "EPG" }],
  cargos: ["Professor", "Secretária"],
  turmas: [{ id: "22222222-2222-2222-2222-222222222222", nome: "3º ANO A", ano_letivo: 2026 }],
  disciplinas: [{ id: "33333333-3333-3333-3333-333333333333", nome: "Matemática", serie: "3º ANO" }],
};
const inicial = { companyId: null, situacao: "ativo", categoria: null, cargo: null, turmaIds: [], disciplinaIds: [] };

describe("FiltrosRhForm", () => {
  it("funcionário: não mostra turma/disciplina; não emite nada até clicar em Aplicar", () => {
    const onChange = vi.fn();
    render(<FiltrosRhForm opcoes={opcoes} professor={false} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Turmas:")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(onChange).toHaveBeenCalledWith(inicial);
  });

  it("professor: filtra por turma (dropdown multi-seleção)", () => {
    const onChange = vi.fn();
    render(<FiltrosRhForm opcoes={opcoes} professor onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^Turmas:/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "3º ANO A (2026)" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...inicial, turmaIds: ["22222222-2222-2222-2222-222222222222"] });
  });

  it("empresa e situação", () => {
    const onChange = vi.fn();
    render(<FiltrosRhForm opcoes={opcoes} professor={false} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Empresa"), { target: { value: "11111111-1111-1111-1111-111111111111" } });
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "todos" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...inicial, companyId: "11111111-1111-1111-1111-111111111111", situacao: "todos" });
  });
});
