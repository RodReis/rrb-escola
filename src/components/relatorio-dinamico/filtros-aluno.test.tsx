// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FiltrosAlunoForm } from "./filtros-aluno";

const opcoes = {
  anos: [2026, 2025],
  series: [{ id: "s1", nome: "3º ANO", segmento: "FUNDAMENTAL1" }],
  turmas: [{ id: "t1", nome: "A", serie_id: "s1", ano_letivo: 2026 }, { id: "t2", nome: "B", serie_id: "s1", ano_letivo: 2025 }],
};

describe("FiltrosAlunoForm", () => {
  it("emite filtro inicial com ano mais recente e status ativa", () => {
    const onChange = vi.fn();
    render(<FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith({ ano: 2026, filtrarPor: "serie", valores: [], status: ["ativa"] });
  });
  it("trocar para turma mostra só turmas do ano e limpa valores", () => {
    const onChange = vi.fn();
    render(<FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Filtrar por"), { target: { value: "turma" } });
    expect(screen.getByRole("checkbox", { name: "3º ANO A" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "3º ANO B" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "3º ANO A" }));
    expect(onChange).toHaveBeenLastCalledWith({ ano: 2026, filtrarPor: "turma", valores: ["t1"], status: ["ativa"] });
  });
  it("não deixa desmarcar o último status", () => {
    const onChange = vi.fn();
    render(<FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativa" }));
    expect(screen.getByRole("checkbox", { name: "Ativa" })).toBeChecked();
  });
});
