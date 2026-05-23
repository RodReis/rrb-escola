import { describe, it, expect } from "vitest";
import { filtrarDestinatarios } from "./destinatarios";

describe("filtrarDestinatarios", () => {
  it("inclui aluno com responsável financeiro e celular", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [
          { celular: "62999990000", responsavel_financeiro: true },
        ],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([
      { alunoId: "aluno-1", telefone: "62999990000" },
    ]);
  });

  it("ignora responsável não-financeiro", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [
          { celular: "62999990000", responsavel_financeiro: false },
        ],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([]);
  });

  it("ignora responsável financeiro sem celular", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [
          { celular: null, responsavel_financeiro: true },
        ],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([]);
  });

  it("escolhe o responsável financeiro entre vários responsáveis", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [
          { celular: "62911112222", responsavel_financeiro: false },
          { celular: "62933334444", responsavel_financeiro: true },
        ],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([
      { alunoId: "aluno-1", telefone: "62933334444" },
    ]);
  });

  it("aluno sem nenhum responsável é ignorado", () => {
    const linhas = [{ id: "aluno-1", responsaveis_aluno: [] }];
    expect(filtrarDestinatarios(linhas)).toEqual([]);
  });

  it("processa vários alunos", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [{ celular: "62900000001", responsavel_financeiro: true }],
      },
      {
        id: "aluno-2",
        responsaveis_aluno: [{ celular: "62900000002", responsavel_financeiro: true }],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([
      { alunoId: "aluno-1", telefone: "62900000001" },
      { alunoId: "aluno-2", telefone: "62900000002" },
    ]);
  });
});
