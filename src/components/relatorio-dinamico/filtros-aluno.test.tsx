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
  it("não emite nada até o usuário clicar em Aplicar filtros", () => {
    const onChange = vi.fn();
    render(<FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(onChange).toHaveBeenCalledWith({ ano: 2026, filtrarPor: "serie", valores: [], status: ["ativa"] });
  });

  it("trocar para turma mostra só turmas do ano e limpa o valor escolhido", () => {
    const onChange = vi.fn();
    render(<FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Filtrar por"), { target: { value: "turma" } });
    fireEvent.click(screen.getByRole("button", { name: /^Turma:/ }));
    expect(screen.getByRole("button", { name: "3º ANO A" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "3º ANO B" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "3º ANO A" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith({ ano: 2026, filtrarPor: "turma", valores: ["t1"], status: ["ativa"] });
  });

  it("não deixa desmarcar o último status de matrícula", () => {
    const onChange = vi.fn();
    render(<FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Ativa" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: ["ativa"] }));
  });
});
