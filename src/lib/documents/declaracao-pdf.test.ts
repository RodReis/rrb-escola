import { describe, it, expect } from "vitest";
import { renderDeclaracoes, type DeclaracaoPdfDados } from "./declaracao-pdf";
import type { HistoricoCredenciamento } from "@/lib/historico/tipos";

function credenciamentoFake(): HistoricoCredenciamento {
  return {
    razaoSocial: "Escola Pinguinho de Gente Ltda",
    nomeFantasia: "EPG Trindade",
    cnpj: "11.714.876/0001-16",
    resolucao: "RESOLUÇÃO CEE/CEB Nº 518/2024",
    endereco: "Rua Eugênio Jardim, 473",
    cidade: "Trindade",
    uf: "GO",
    cep: "75388-686",
    telefones: null,
    email: null,
    logoPath: null,
    secretarioNome: "Keila Regina",
    secretarioCargo: "Secretário(a)",
    diretorNome: "Rafaela Machado",
    diretorCargo: "Diretor(a)"
  };
}

function paginaFake(overrides: Partial<DeclaracaoPdfDados> = {}): DeclaracaoPdfDados {
  return {
    credenciamento: credenciamentoFake(),
    titulo: "DECLARAÇÃO",
    corpo: "Declaramos para os devidos fins que o(a) aluno(a) MARIA DA SILVA está regularmente matriculado(a).",
    fecho: "Trindade, 24 de setembro de 2026",
    ...overrides
  };
}

describe("renderDeclaracoes", () => {
  it("gera 1 página por item da lista", () => {
    const doc = renderDeclaracoes([paginaFake(), paginaFake()], new Map());
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it("lista vazia devolve documento com 1 página em branco", () => {
    const doc = renderDeclaracoes([], new Map());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("não quebra sem logo (imagens vazio) nem sem secretário/diretor cadastrados", () => {
    const semAssinatura: HistoricoCredenciamento = {
      ...credenciamentoFake(),
      secretarioNome: null,
      diretorNome: null
    };
    expect(() =>
      renderDeclaracoes([paginaFake({ credenciamento: semAssinatura })], new Map())
    ).not.toThrow();
  });

  it("cabeçalho ausente (empresa sem nome_fantasia nem endereço) não quebra", () => {
    const vazio: HistoricoCredenciamento = {
      razaoSocial: "", nomeFantasia: "", cnpj: null, resolucao: null,
      endereco: null, cidade: null, uf: null, cep: null, telefones: null,
      email: null, logoPath: null, secretarioNome: null,
      secretarioCargo: "Secretário(a)", diretorNome: null, diretorCargo: "Diretor(a)"
    };
    expect(() => renderDeclaracoes([paginaFake({ credenciamento: vazio })], new Map())).not.toThrow();
  });
});
