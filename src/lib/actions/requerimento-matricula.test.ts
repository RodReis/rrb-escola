import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePermission = vi.fn().mockResolvedValue({ profile: { escola_id: "escola-1" } });
vi.mock("@/lib/auth/session", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args)
}));

const mockBuscarDadosRequerimento = vi.fn();
vi.mock("@/lib/data/requerimento-matricula", () => ({
  buscarDadosRequerimento: (...args: unknown[]) => mockBuscarDadosRequerimento(...args)
}));

const mockGetCredenciamentoVigente = vi.fn();
vi.mock("@/lib/data/historico", () => ({
  getCredenciamentoVigente: (...args: unknown[]) => mockGetCredenciamentoVigente(...args)
}));

import { carregarRequerimentosAction, previsualizarRequerimentoAction } from "./requerimento-matricula";
import type { DadosRequerimento } from "@/lib/data/requerimento-matricula";

const credenciamento = {
  logoPath: null,
  nomeFantasia: "ESCOLA PINGUINHO DE GENTE LTDA",
  cnpj: "11.714.876/0001-16",
  endereco: "RUA EUGÊNIO JARDIM Nº 473",
  cidade: "Trindade",
  uf: "GO",
  cep: "75388-686",
  telefones: "(62)3505-1531",
  email: "secretariaepgtrindade@gmail.com",
  secretarioNome: "Rossania Brígida Rodrigues Ribeiro Barbosa",
  secretarioCargo: "Secretário(a)",
  diretorNome: "Ciclana",
  diretorCargo: "Diretora"
};

function dadosPara(nome: string, comResponsavelFinanceiro: boolean): DadosRequerimento {
  return {
    aluno: {
      matricula: "1754",
      nome,
      sexo: "Feminino",
      dataNascimento: "2017-01-31",
      naturalidade: "GOIÂNIA-GO",
      telefones: null,
      endereco: null,
      cpf: null,
      rg: null,
      etnia: null,
      religiao: null
    },
    pai: null,
    mae: null,
    matricula: {
      anoLetivo: 2027,
      serieId: "serie-1",
      serie: "5º ANO",
      turma: "A",
      turno: "Matutino",
      tipoEnsino: "Ensino Fundamental",
      dataMatricula: "2026-10-16"
    },
    responsavelFinanceiro: comResponsavelFinanceiro
      ? { nome: "Ana Paula Nunes da Silva", cpfOuCnpj: "043.638.081-10", parentesco: "Mãe" }
      : null
  };
}

describe("previsualizarRequerimentoAction", () => {
  beforeEach(() => {
    mockRequirePermission.mockClear();
    mockGetCredenciamentoVigente.mockReset().mockResolvedValue(credenciamento);
  });

  it("checa a permissao historico/read antes de buscar os dados", async () => {
    mockBuscarDadosRequerimento.mockResolvedValue(dadosPara("Ana", true));
    await previsualizarRequerimentoAction("matricula-1");
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "read");
  });

  it("lança quando o aluno não tem responsável financeiro cadastrado", async () => {
    mockBuscarDadosRequerimento.mockResolvedValue(dadosPara("Ana", false));
    await expect(previsualizarRequerimentoAction("matricula-1")).rejects.toThrow(/[Rr]esponsável financeiro/);
  });

  it("devolve os dados quando o responsável financeiro existe", async () => {
    mockBuscarDadosRequerimento.mockResolvedValue(dadosPara("Ana", true));
    const resultado = await previsualizarRequerimentoAction("matricula-1");
    expect(resultado.aluno.nome).toBe("Ana");
  });
});

describe("carregarRequerimentosAction", () => {
  beforeEach(() => {
    mockRequirePermission.mockClear();
    mockGetCredenciamentoVigente.mockReset().mockResolvedValue(credenciamento);
  });

  it("checa a permissao historico/read antes de montar as paginas", async () => {
    mockBuscarDadosRequerimento.mockResolvedValue(dadosPara("Ana", true));
    await carregarRequerimentosAction(["m1"], null);
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "read");
  });

  it("lote com um aluno sem responsável financeiro: os outros saem normalmente e ele cai em falhas", async () => {
    mockBuscarDadosRequerimento.mockImplementation(async (matriculaId: string) => {
      if (matriculaId === "m1") return dadosPara("Ana", true);
      if (matriculaId === "m2") return dadosPara("Beto", false);
      if (matriculaId === "m3") return dadosPara("Carla", true);
      throw new Error("matrícula inesperada");
    });

    const resultado = await carregarRequerimentosAction(["m1", "m2", "m3"], null);

    expect(resultado.paginas).toHaveLength(2);
    expect(resultado.falhas).toEqual([{ nome: "Beto", motivo: "Responsável financeiro não cadastrado." }]);
  });

  it("propaga a mesma observação para todas as páginas do lote", async () => {
    mockBuscarDadosRequerimento.mockImplementation(async (matriculaId: string) =>
      dadosPara(matriculaId, true)
    );

    const resultado = await carregarRequerimentosAction(["m1", "m2"], "Observação do dia");

    expect(resultado.paginas.every((p) => p.observacoes === "Observação do dia")).toBe(true);
  });

  it("exceção ao buscar dados de um aluno não interrompe os demais e aparece em falhas", async () => {
    mockBuscarDadosRequerimento.mockImplementation(async (matriculaId: string) => {
      if (matriculaId === "m1") throw new Error("Aluno sem série vinculada");
      if (matriculaId === "m2") return dadosPara("Beto", true);
      throw new Error("matrícula inesperada");
    });

    const resultado = await carregarRequerimentosAction(["m1", "m2"], null);

    expect(resultado.paginas).toHaveLength(1);
    expect(resultado.falhas).toEqual([{ nome: "m1", motivo: "Aluno sem série vinculada" }]);
  });
});
