// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ criar: vi.fn(), atualizar: vi.fn() }));
vi.mock("@/lib/actions/questionario-questoes", () => ({
  criarQuestaoAction: h.criar,
  atualizarQuestaoAction: h.atualizar,
}));
vi.mock("@/lib/hooks/use-action", () => ({
  useAction: (fn: (...a: unknown[]) => unknown) => ({
    run: (...a: unknown[]) => void fn(...a),
    pending: false,
  }),
}));

import { QuestaoForm } from "./questao-form";
import type { EscalaRow, GrupoRow, QuestaoDetalhe } from "@/lib/questionario/tipos";

const GRUPOS: GrupoRow[] = [
  { id: "g1", codigo: 1, descricao: "O EU", ativo: true },
  { id: "g2", codigo: 2, descricao: "CORPO", ativo: false },
];

const ESCALAS: EscalaRow[] = [
  { id: "e1", descricao: "Desenvolvimento", ativo: true, opcoes: ["A", "B"] },
  { id: "e2", descricao: "Antiga", ativo: false, opcoes: ["X", "Y"] },
];

const questao: QuestaoDetalhe = {
  id: "q1", grupoId: "g1", tipo: "subjetiva", pergunta: "Explique", ativa: true, obrigatoria: false,
  limitarCaracteres: false, qtdeCaracteres: 0, qtdeLinhas: 0, alternativas: [], emUso: false, escalaId: null,
};

describe("QuestaoForm", () => {
  it("subjetiva mostra qtde de linhas; única escolha troca por alternativas", () => {
    render(<QuestaoForm grupos={GRUPOS} escalas={ESCALAS} />);
    expect(screen.getByLabelText(/Qtde\. Linhas/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Alternativa 1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tipo de Questão/), { target: { value: "objetiva_unica" } });

    expect(screen.queryByLabelText(/Qtde\. Linhas/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Alternativa 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Alternativa 2")).toBeInTheDocument();
  });

  it("qtde de caracteres só habilita quando limitar = sim", () => {
    render(<QuestaoForm grupos={GRUPOS} escalas={ESCALAS} />);
    const qtde = screen.getByLabelText(/Qtde\. Caracteres/);
    expect(qtde).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Limitar quantidade de caracteres/));
    expect(qtde).toBeEnabled();
  });

  it("questão com escala mostra o seletor de escala (só ativas); outros tipos não", () => {
    render(<QuestaoForm grupos={GRUPOS} escalas={ESCALAS} />);
    expect(screen.queryByLabelText(/^Escala/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tipo de Questão/), { target: { value: "objetiva_escala" } });

    expect(screen.getByLabelText(/^Escala/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Desenvolvimento" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Antiga" })).not.toBeInTheDocument();
  });

  it("envia a escala escolhida", () => {
    h.criar.mockResolvedValue({ ok: true });
    render(<QuestaoForm grupos={GRUPOS} escalas={ESCALAS} />);
    fireEvent.change(screen.getByLabelText(/Grupo/), { target: { value: "g1" } });
    fireEvent.change(screen.getByLabelText(/Tipo de Questão/), { target: { value: "objetiva_escala" } });
    fireEvent.change(screen.getByLabelText(/^Escala/), { target: { value: "e1" } });
    fireEvent.change(screen.getByLabelText(/^Pergunta/), { target: { value: "Respeita regras?" } });
    fireEvent.submit(screen.getByRole("button", { name: /gravar/i }).closest("form")!);
    const fd = h.criar.mock.calls[h.criar.mock.calls.length - 1][0] as FormData;
    expect(fd.get("tipo")).toBe("objetiva_escala");
    expect(fd.get("escalaId")).toBe("e1");
  });

  it("grupo inativo só aparece se for o grupo da própria questão", () => {
    render(<QuestaoForm grupos={GRUPOS} escalas={ESCALAS} />);
    expect(screen.queryByRole("option", { name: "CORPO" })).not.toBeInTheDocument();
  });

  it("questão em uso trava o tipo e avisa", () => {
    render(<QuestaoForm grupos={GRUPOS} escalas={ESCALAS} questao={{ ...questao, emUso: true }} />);
    expect(screen.getByLabelText(/Tipo de Questão/)).toBeDisabled();
    expect(screen.getByText(/em uso em questionário/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="hidden"][name="tipo"]')).toHaveValue("subjetiva");
  });

  it("envia os campos para criar (id ausente) e inclui as alternativas", () => {
    h.criar.mockResolvedValue({ ok: true });
    render(<QuestaoForm grupos={GRUPOS} escalas={ESCALAS} />);
    fireEvent.change(screen.getByLabelText(/Grupo/), { target: { value: "g1" } });
    fireEvent.change(screen.getByLabelText(/Tipo de Questão/), { target: { value: "objetiva_unica" } });
    fireEvent.change(screen.getByLabelText(/^Pergunta/), { target: { value: "Gosta?" } });
    fireEvent.change(screen.getByLabelText("Alternativa 1"), { target: { value: "Sim" } });
    fireEvent.change(screen.getByLabelText("Alternativa 2"), { target: { value: "Não" } });
    fireEvent.submit(screen.getByRole("button", { name: /gravar/i }).closest("form")!);

    const fd = h.criar.mock.calls[h.criar.mock.calls.length - 1][0] as FormData;
    expect(fd.get("grupoId")).toBe("g1");
    expect(fd.get("tipo")).toBe("objetiva_unica");
    expect(fd.get("pergunta")).toBe("Gosta?");
    expect(fd.getAll("alternativas")).toEqual(["Sim", "Não"]);
    expect(fd.get("id")).toBeNull();
  });
});
