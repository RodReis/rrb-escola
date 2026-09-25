// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListaDupla } from "./lista-dupla";
import type { ColunaMeta } from "@/lib/relatorio-dinamico/tipos";

const cols: ColunaMeta[] = [
  { key: "a", label: "Bairro", grupo: "Endereço", tipo: "texto" },
  { key: "b", label: "Nome Aluno", grupo: "Dados", tipo: "texto" },
  { key: "c", label: "CEP", grupo: "Endereço", tipo: "texto" },
];

describe("ListaDupla", () => {
  it("move marcados para a direita, no fim", () => {
    const onChange = vi.fn();
    render(<ListaDupla disponiveis={cols} selecionadas={["b"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Bairro" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar selecionados" }));
    expect(onChange).toHaveBeenCalledWith(["b", "a"]);
  });
  it("remove marcados da direita", () => {
    const onChange = vi.fn();
    render(<ListaDupla disponiveis={cols} selecionadas={["b", "a"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Nome Aluno" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover selecionados" }));
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });
  it("duplo clique move um item e busca filtra", () => {
    const onChange = vi.fn();
    render(<ListaDupla disponiveis={cols} selecionadas={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Pesquisar dados disponíveis"), { target: { value: "cep" } });
    expect(screen.queryByText("Bairro")).toBeNull();
    fireEvent.doubleClick(screen.getByText("CEP"));
    expect(onChange).toHaveBeenCalledWith(["c"]);
  });
  it("contadores de rodapé", () => {
    render(<ListaDupla disponiveis={cols} selecionadas={[]} onChange={vi.fn()} />);
    expect(screen.getAllByText("Nenhum item selecionado")).toHaveLength(2);
  });
});
