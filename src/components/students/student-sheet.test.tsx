// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudentSheetView } from "./student-sheet";

function buildStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: "aluno-1",
    matricula_codigo: "0001",
    nome: "Ana Souza",
    sexo: null,
    data_nascimento: null,
    naturalidade: null,
    celular: null,
    cpf: null,
    rg: null,
    certidao_nascimento: null,
    certidao_livro: null,
    certidao_folha: null,
    certidao_numero: null,
    certidao_cartorio: null,
    email: null,
    codigo_inep: null,
    etnia: null,
    informacoes_adicionais: null,
    foto_url: null,
    disciplina_eletiva: null,
    enderecos_aluno: [],
    contatos_aluno: [],
    responsaveis_aluno: [],
    pessoas_autorizadas: [],
    informacoes_medicas: null,
    autorizacoes_aluno: null,
    matriculas: [
      {
        id: "m1",
        codigo: null,
        data_matricula: "2026-01-15",
        ano_letivo: 2026,
        idade_na_matricula: 10,
        status: "cancelada",
        observacoes: null,
        cancelamento_data: "2026-04-10",
        cancelamento_motivo: "transferencia",
        series: { nome: "5º Ano" },
        turmas: { nome: "A" },
        planos: null,
      },
    ],
    ...overrides,
  };
}

describe("StudentSheetView — selo de cancelamento", () => {
  it("mostra selo Cancelado com ano quando a matricula tem cancelamento_data", () => {
    render(<StudentSheetView student={buildStudent() as never} fotoSrc={null} geradoEm={new Date()} />);
    expect(screen.getByText(/cancelado.*2026/i)).toBeInTheDocument();
  });

  it("nao mostra selo quando a matricula esta ativa", () => {
    const student = buildStudent({
      matriculas: [
        {
          id: "m1",
          codigo: null,
          data_matricula: "2026-01-15",
          ano_letivo: 2026,
          idade_na_matricula: 10,
          status: "ativa",
          observacoes: null,
          cancelamento_data: null,
          cancelamento_motivo: null,
          series: { nome: "5º Ano" },
          turmas: { nome: "A" },
          planos: null,
        },
      ],
    });
    render(<StudentSheetView student={student as never} fotoSrc={null} geradoEm={new Date()} />);
    expect(screen.queryByText(/cancelado/i)).not.toBeInTheDocument();
  });
});
