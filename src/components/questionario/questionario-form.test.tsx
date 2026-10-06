// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ criar: vi.fn(), atualizar: vi.fn() }));
vi.mock("@/lib/actions/questionario-questionarios", () => ({
  criarQuestionarioAction: h.criar,
  atualizarQuestionarioAction: h.atualizar,
}));
vi.mock("@/lib/hooks/use-action", () => ({
  useAction: (fn: (...a: unknown[]) => unknown) => ({
    run: (...a: unknown[]) => void fn(...a),
    pending: false,
  }),
}));

import { QuestionarioForm } from "./questionario-form";
import type { EscalaRow, GrupoRow, QuestaoLinha } from "@/lib/questionario/tipos";

const GRUPOS: GrupoRow[] = [
  { id: "g1", codigo: 1, descricao: "O EU", ativo: true },
  { id: "g2", codigo: 2, descricao: "CORPO", ativo: true },
];
const QUESTOES: QuestaoLinha[] = [
  { id: "q1", tipo: "subjetiva", pergunta: "Compartilha?", ativa: true, grupoId: "g1", grupoDescricao: "O EU" },
  { id: "q2", tipo: "objetiva_escala", pergunta: "Respeita regras?", ativa: true, grupoId: "g1", grupoDescricao: "O EU" },
  { id: "q3", tipo: "objetiva_escala", pergunta: "Desloca o corpo?", ativa: true, grupoId: "g2", grupoDescricao: "CORPO" },
  { id: "q4", tipo: "subjetiva", pergunta: "Inativa", ativa: false, grupoId: "g2", grupoDescricao: "CORPO" },
];
const ESCALAS: EscalaRow[] = [{ id: "e1", descricao: "Desenv.", ativo: true, opcoes: ["A", "B"] }];

const perguntasNaTabela = () =>
  screen.getAllByTestId("linha-vinculo").map((tr) => within(tr).getByTestId("pergunta").textContent);

function renderForm() {
  return render(<QuestionarioForm grupos={GRUPOS} questoes={QUESTOES} escalas={ESCALAS} />);
}

describe("QuestionarioForm", () => {
  it("'Todos' de um grupo adiciona todas as questões ativas do grupo (e só uma vez)", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(perguntasNaTabela()).toEqual(["Compartilha?", "Respeita regras?"]);

    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(perguntasNaTabela()).toHaveLength(2);
  });

  it("não oferece questão inativa", () => {
    renderForm();
    expect(screen.queryByRole("option", { name: "Inativa" })).not.toBeInTheDocument();
  });

  it("escala só aparece para questão objetiva com escala", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(screen.queryByLabelText("Escala de Compartilha?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Escala de Respeita regras?")).toBeInTheDocument();
  });

  it("reordena e remove", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getByRole("button", { name: "Descer Compartilha?" }));
    expect(perguntasNaTabela()).toEqual(["Respeita regras?", "Compartilha?"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover Respeita regras?" }));
    expect(perguntasNaTabela()).toEqual(["Compartilha?"]);
  });

  it("envia vínculos em JSON na ordem exibida, com a escala escolhida", () => {
    h.criar.mockResolvedValue({ ok: true });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: "Quadro" } });
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.change(screen.getByLabelText("Escala de Respeita regras?"), { target: { value: "e1" } });
    fireEvent.submit(screen.getByRole("button", { name: /gravar/i }).closest("form")!);

    const fd = h.criar.mock.calls[0][0] as FormData;
    expect(fd.get("descricao")).toBe("Quadro");
    expect(JSON.parse(String(fd.get("vinculos")))).toEqual([
      { questaoId: "q1", escalaId: null },
      { questaoId: "q2", escalaId: "e1" },
    ]);
    expect(fd.get("id")).toBeNull();
  });

  it("na edição, carrega os vínculos existentes com seus ids", () => {
    h.atualizar.mockResolvedValue({ ok: true });
    render(
      <QuestionarioForm
        grupos={GRUPOS}
        questoes={QUESTOES}
        escalas={ESCALAS}
        questionario={{
          id: "qq", descricao: "Existente", observacoes: null, ativo: true,
          vinculos: [{ id: "v1", questaoId: "q3", escalaId: "e1" }],
        }}
      />,
    );
    expect(perguntasNaTabela()).toEqual(["Desloca o corpo?"]);
    fireEvent.submit(screen.getByRole("button", { name: /gravar/i }).closest("form")!);
    const fd = h.atualizar.mock.calls[0][0] as FormData;
    expect(fd.get("id")).toBe("qq");
    expect(JSON.parse(String(fd.get("vinculos")))).toEqual([{ id: "v1", questaoId: "q3", escalaId: "e1" }]);
  });
});
