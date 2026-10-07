// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ criar: vi.fn(), atualizar: vi.fn() }));
vi.mock("@/lib/actions/questionario-associacoes", () => ({
  criarAssociacoesAction: h.criar,
  atualizarAssociacaoAction: h.atualizar,
}));
vi.mock("@/lib/hooks/use-action", () => ({
  useAction: (fn: (...a: unknown[]) => unknown) => ({
    run: (...a: unknown[]) => void fn(...a),
    pending: false,
  }),
}));

import { AssociacoesForm } from "./associacoes-form";
import type { AssociacaoRow, QuestionarioRow, TurmaOpcao } from "@/lib/questionario/tipos";

const turma = (id: string, nome: string, turno: string, anoLetivo: number, serieId: string, serieNome: string, ordem: number, ativo = true): TurmaOpcao =>
  ({ id, nome, turno, anoLetivo, ativo, serieId, serieNome, serieOrdem: ordem });

const TURMAS: TurmaOpcao[] = [
  turma("t1", "Matutino", "matutino", 2026, "s3", "INFANTIL 3", 3),
  turma("t2", "Vespertino", "vespertino", 2026, "s3", "INFANTIL 3", 3),
  turma("t3", "Matutino", "matutino", 2026, "s4", "INFANTIL 4", 4),
  turma("t4", "Antiga", "matutino", 2025, "s3", "INFANTIL 3", 3),
  turma("t5", "Fechada", "noturno", 2026, "s3", "INFANTIL 3", 3, false),
];
const QUESTIONARIOS: QuestionarioRow[] = [
  { id: "q1", descricao: "QUADRO INFANTIL 3", ativo: true },
  { id: "q2", descricao: "QUADRO ANTIGO", ativo: false },
];
const PROFESSORES = [
  { id: "p1", nome: "Stéfanny Guimarães", email: "", schoolCategory: "fund1" as const },
];
const EDICAO: AssociacaoRow = {
  id: "a1", ativo: true, etapa: 2, questionarioId: "q1", questionarioDescricao: "QUADRO INFANTIL 3",
  turmaId: "t1", turmaNome: "Matutino", turno: "matutino", anoLetivo: 2026, serieId: "s3", serieNome: "INFANTIL 3",
  professorId: "p1", professorNome: "Stéfanny Guimarães",
};

function renderForm(edicao: AssociacaoRow | null = null) {
  return render(
    <AssociacoesForm questionarios={QUESTIONARIOS} turmas={TURMAS} professores={PROFESSORES} edicao={edicao} onConcluir={vi.fn()} />,
  );
}

describe("AssociacoesForm (lote)", () => {
  it("mostra só turmas ativas do ano padrão e da série escolhida", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "s3" } });
    expect(screen.getByLabelText("Matutino")).toBeInTheDocument();
    expect(screen.getByLabelText("Vespertino")).toBeInTheDocument();
    expect(screen.queryByLabelText("Antiga (Matutino)")).not.toBeInTheDocument(); // 2025
    expect(screen.queryByLabelText(/Fechada/)).not.toBeInTheDocument(); // inativa
  });

  it("não oferece questionário inativo", () => {
    renderForm();
    expect(screen.queryByRole("option", { name: "QUADRO ANTIGO" })).not.toBeInTheDocument();
  });

  it("'Todas' marca todas as turmas visíveis; envia etapas e turmas repetidas", () => {
    h.criar.mockResolvedValue({ ok: true });
    renderForm();
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "s3" } });
    fireEvent.click(screen.getByLabelText("Todas as turmas"));
    fireEvent.click(screen.getByLabelText("1ª etapa"));
    fireEvent.click(screen.getByLabelText("3ª etapa"));
    fireEvent.change(screen.getByLabelText("Questionário"), { target: { value: "q1" } });
    fireEvent.change(screen.getByLabelText("Professor"), { target: { value: "p1" } });
    fireEvent.submit(screen.getByRole("button", { name: /cadastrar/i }).closest("form")!);

    const fd = h.criar.mock.calls[h.criar.mock.calls.length - 1][0] as FormData;
    expect(fd.getAll("turmaIds")).toEqual(["t1", "t2"]);
    expect(fd.getAll("etapas")).toEqual(["1", "3"]);
    expect(fd.get("questionarioId")).toBe("q1");
    expect(fd.get("professorId")).toBe("p1");
    expect(fd.get("id")).toBeNull();
  });

  it("trocar a série limpa as turmas marcadas", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "s3" } });
    fireEvent.click(screen.getByLabelText("Todas as turmas"));
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "s4" } });
    expect((screen.getByLabelText("Matutino") as HTMLInputElement).checked).toBe(false);
  });
});

describe("AssociacoesForm (edição)", () => {
  it("vira modo unitário: id oculto, etapa e turma únicas, valores atuais", () => {
    h.atualizar.mockResolvedValue({ ok: true });
    renderForm(EDICAO);
    expect(screen.queryByLabelText("Todas as turmas")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Etapa")).toHaveValue("2");
    expect(screen.getByLabelText("Turma")).toHaveValue("t1");
    fireEvent.change(screen.getByLabelText("Etapa"), { target: { value: "4" } });
    fireEvent.submit(screen.getByRole("button", { name: /salvar/i }).closest("form")!);

    const fd = h.atualizar.mock.calls[h.atualizar.mock.calls.length - 1][0] as FormData;
    expect(fd.get("id")).toBe("a1");
    expect(fd.get("etapa")).toBe("4");
    expect(fd.get("turmaId")).toBe("t1");
    expect(fd.get("questionarioId")).toBe("q1");
    expect(fd.get("professorId")).toBe("p1");
  });
});
