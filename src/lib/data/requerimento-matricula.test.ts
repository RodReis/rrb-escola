import { beforeEach, describe, it, expect, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({ from: mockFrom })
}));

const { mockGetSignedFotoUrl } = vi.hoisted(() => ({ mockGetSignedFotoUrl: vi.fn() }));
vi.mock("@/lib/storage/photos", () => ({ getSignedFotoUrl: mockGetSignedFotoUrl }));

import { buscarDadosRequerimento, listarAlunosParaRequerimento } from "./requerimento-matricula";

describe("listarAlunosParaRequerimento", () => {
  it("filtra por ano letivo, série, turma e aluno quando informados, só matrícula ativa", async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: [{ id: "m1", aluno_id: "a1", alunos: { nome: "Ana" } }],
      error: null
    });
    const eqChain = { eq: vi.fn().mockReturnThis(), in: inFn };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(eqChain) });

    const resultado = await listarAlunosParaRequerimento({
      anoLetivo: 2027,
      serieId: "serie-1",
      turmaId: "turma-1",
      alunoId: "aluno-1"
    });

    expect(inFn).toHaveBeenCalledWith("status", ["ativa"]);
    expect(eqChain.eq).toHaveBeenCalledWith("escola_id", expect.any(String));
    expect(eqChain.eq).toHaveBeenCalledWith("ano_letivo", 2027);
    expect(eqChain.eq).toHaveBeenCalledWith("serie_id", "serie-1");
    expect(eqChain.eq).toHaveBeenCalledWith("turma_id", "turma-1");
    expect(eqChain.eq).toHaveBeenCalledWith("aluno_id", "aluno-1");
    expect(resultado).toEqual([{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]);
  });

  it("ordena por nome (pt-BR)", async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: [
        { id: "m2", aluno_id: "a2", alunos: { nome: "Zeca" } },
        { id: "m1", aluno_id: "a1", alunos: { nome: "Ana" } },
        { id: "m3", aluno_id: "a3", alunos: { nome: "Éder" } }
      ],
      error: null
    });
    const eqChain = { eq: vi.fn().mockReturnThis(), in: inFn };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(eqChain) });

    const resultado = await listarAlunosParaRequerimento({ anoLetivo: 2027 });

    expect(resultado.map((a) => a.nome)).toEqual(["Ana", "Éder", "Zeca"]);
  });
});

function alunoFake(responsaveis: Record<string, unknown>[]) {
  return {
    codigo: "M-1",
    ano_letivo: 2027,
    serie_id: "serie-1",
    data_matricula: "2026-10-16",
    series: { nome: "5º ANO", segmentos: { nome: "Ensino Fundamental" } },
    turmas: { nome: "A", turno: "Matutino" },
    alunos: {
      matricula_codigo: "1754",
      nome: "Isabela Nunes Fidelis do Nascimento",
      foto_url: "aluno-1/foto.jpg",
      sexo: "Feminino",
      data_nascimento: "2017-01-31",
      naturalidade: "GOIÂNIA-GO",
      celular: "(62)99999-9999",
      cpf: null,
      rg: null,
      etnia: null,
      religiao: null,
      enderecos_aluno: [
        { logradouro: "RUA 114", numero: "8", complemento: "LT 3A", bairro: "SETOR ANA ROSA", cidade: "TRINDADE", uf: "GO", cep: "75389-066", principal: true }
      ],
      responsaveis_aluno: responsaveis
    }
  };
}

function mockMaybeSingle(data: unknown) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null })
      })
    })
  });
}

describe("buscarDadosRequerimento", () => {
  beforeEach(() => {
    mockGetSignedFotoUrl.mockReset().mockResolvedValue("https://signed.example/foto.jpg");
  });

  it("devolve a URL assinada da foto do aluno, ou null quando não há foto", async () => {
    mockMaybeSingle(alunoFake([]));
    expect((await buscarDadosRequerimento("matricula-1")).aluno.fotoUrl).toBe("https://signed.example/foto.jpg");
    expect(mockGetSignedFotoUrl).toHaveBeenCalledWith("aluno-1/foto.jpg");

    mockGetSignedFotoUrl.mockResolvedValue(null);
    mockMaybeSingle(alunoFake([]));
    expect((await buscarDadosRequerimento("matricula-1")).aluno.fotoUrl).toBeNull();
  });

  it("monta todos os campos quando aluno, pai, mãe e responsável financeiro existem", async () => {
    mockMaybeSingle(
      alunoFake([
        { nome: "Amauri Fidelis do Nascimento", rg: "4912539", cpf: "736.971.681-34", cnpj: null, telefone: null, celular: "(62)9931-8574", email: null, data_nascimento: "1988-06-02", estado_civil: "Casado(a)", escolaridade: null, endereco_trabalho: null, profissao: null, telefone_trabalho: null, parentesco: "Pai", responsavel_financeiro: false },
        { nome: "Ana Paula Nunes da Silva", rg: "5550060", cpf: "043.638.081-10", cnpj: null, telefone: null, celular: "(62)99318-5874", email: "ana@example.com", data_nascimento: "1992-06-11", estado_civil: "Casado(a)", escolaridade: null, endereco_trabalho: null, profissao: null, telefone_trabalho: null, parentesco: "Mãe", responsavel_financeiro: true }
      ])
    );

    const resultado = await buscarDadosRequerimento("matricula-1");

    expect(resultado.aluno.nome).toBe("Isabela Nunes Fidelis do Nascimento");
    expect(resultado.pai?.nome).toBe("Amauri Fidelis do Nascimento");
    expect(resultado.mae?.nome).toBe("Ana Paula Nunes da Silva");
    expect(resultado.responsavelFinanceiro).toEqual({
      nome: "Ana Paula Nunes da Silva",
      cpfOuCnpj: "043.638.081-10",
      parentesco: "Mãe"
    });
    expect(resultado.matricula.serie).toBe("5º ANO");
    expect(resultado.matricula.turma).toBe("A");
    expect(resultado.matricula.turno).toBe("Matutino");
    expect(resultado.matricula.tipoEnsino).toBe("Ensino Fundamental");
  });

  it("aluno sem pai cadastrado: pai null, resto preenchido", async () => {
    mockMaybeSingle(
      alunoFake([
        { nome: "Ana Paula Nunes da Silva", rg: "5550060", cpf: "043.638.081-10", cnpj: null, telefone: null, celular: null, email: null, data_nascimento: null, estado_civil: null, escolaridade: null, endereco_trabalho: null, profissao: null, telefone_trabalho: null, parentesco: "Mãe", responsavel_financeiro: true }
      ])
    );

    const resultado = await buscarDadosRequerimento("matricula-1");

    expect(resultado.pai).toBeNull();
    expect(resultado.mae?.nome).toBe("Ana Paula Nunes da Silva");
  });

  it("dois responsáveis financeiros: escolhe sempre o mesmo, ordenado por nome", async () => {
    mockMaybeSingle(
      alunoFake([
        { nome: "Zeca Responsável", rg: null, cpf: "111", cnpj: null, telefone: null, celular: null, email: null, data_nascimento: null, estado_civil: null, escolaridade: null, endereco_trabalho: null, profissao: null, telefone_trabalho: null, parentesco: "Pai", responsavel_financeiro: true },
        { nome: "Ana Responsável", rg: null, cpf: "222", cnpj: null, telefone: null, celular: null, email: null, data_nascimento: null, estado_civil: null, escolaridade: null, endereco_trabalho: null, profissao: null, telefone_trabalho: null, parentesco: "Mãe", responsavel_financeiro: true }
      ])
    );

    const resultado = await buscarDadosRequerimento("matricula-1");

    expect(resultado.responsavelFinanceiro?.nome).toBe("Ana Responsável");
  });

  it("aluno sem responsável financeiro: responsavelFinanceiro null, não lança", async () => {
    mockMaybeSingle(
      alunoFake([
        { nome: "Amauri Fidelis do Nascimento", rg: null, cpf: null, cnpj: null, telefone: null, celular: null, email: null, data_nascimento: null, estado_civil: null, escolaridade: null, endereco_trabalho: null, profissao: null, telefone_trabalho: null, parentesco: "Pai", responsavel_financeiro: false }
      ])
    );

    const resultado = await buscarDadosRequerimento("matricula-1");

    expect(resultado.responsavelFinanceiro).toBeNull();
  });

  it("matrícula inexistente: lança erro", async () => {
    mockMaybeSingle(null);

    await expect(buscarDadosRequerimento("matricula-inexistente")).rejects.toThrow();
  });

  it("erro real de query (ex. coluna nova sem migration aplicada) propaga a mensagem real, não 'Matrícula não encontrada' (bug I3 da revisão)", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'column "religiao" does not exist' }
          })
        })
      })
    });

    await expect(buscarDadosRequerimento("matricula-1")).rejects.toThrow(/religiao/);
  });
});
