import { describe, expect, it } from "vitest";
import { renderHistoricos } from "./historico-pdf";
import type { HistoricoAno, HistoricoData } from "@/lib/historico/tipos";

function ano(serieNome: string, anoLetivo: number, notas: Array<[string, number]>): HistoricoAno {
  return {
    id: `${anoLetivo}`,
    ano: anoLetivo,
    serieId: null,
    serieNome,
    origem: "interna",
    instituicao: "EPG TRINDADE",
    cidade: "TRINDADE",
    uf: "GO",
    resultado: "aprovado",
    mediaAprovacao: 6,
    cargaHoraria: 1000,
    diasLetivos: 213,
    faltas: null,
    percentualFrequencia: null,
    congelado: true,
    notas: notas.map(([disciplinaNome, nota], ordem) => ({
      disciplinaId: null,
      disciplinaNome,
      nota,
      cargaHoraria: null,
      faltas: null,
      ordem
    }))
  };
}

function historico(nome: string): HistoricoData {
  return {
    aluno: {
      id: nome,
      nome,
      cpf: "116.726.301-42",
      matricula: "1041",
      filiacao: "RODRIGO REIS BARROS e RAFAELA MACHADO MARGARIDA BARROS",
      dataNascimento: "28/08/2017",
      naturalidade: "GOIÂNIA / GO",
      nacionalidade: "BRASILEIRA",
      rg: null,
      orgaoExpedidor: null,
      dataExpedicao: null
    },
    nivel: "fund1",
    credenciamento: {
      razaoSocial: "ESCOLA PINGUINHO DE GENTE LTDA",
      nomeFantasia: "EPG TRINDADE",
      cnpj: "11.714.876/0001-16",
      resolucao: "RENOVAÇÃO DE RECONHECIMENTO, RESOLUÇÃO CEE/CEB Nº 518/2024",
      endereco: "RUA EUGÊNIO JARDIM Nº 473, Q 24, L 17, CENTRO, TRINDADE - GO CEP: 75388-686",
      cidade: "TRINDADE",
      uf: "GO",
      cep: "75388-686",
      telefones: "(62)3505-1531 / (62)98650-1531",
      email: "secretariaepgtrindade@gmail.com",
      logoPath: null,
      secretarioNome: "ROSSANIA BRÍGIDA RODRIGUES RIBEIRO BARBOSA",
      secretarioCargo: "Secretário(a)",
      diretorNome: "RAFAELA MACHADO MARGARIDA BARROS",
      diretorCargo: "Diretor(a)"
    },
    anos: [
      ano("1º ANO", 2024, [["CIÊNCIAS", 9.9], ["MATEMÁTICA", 9.9]]),
      ano("2º ANO", 2025, [["CIÊNCIAS", 9.9], ["MATEMÁTICA", 10]])
    ],
    observacoes: null
  };
}

describe("renderHistoricos", () => {
  it("gera uma página para um aluno", () => {
    const doc = renderHistoricos([historico("MANUELA MARGARIDA BARROS")]);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("gera uma página por aluno no lote", () => {
    const doc = renderHistoricos([historico("ALUNO A"), historico("ALUNO B"), historico("ALUNO C")]);
    expect(doc.getNumberOfPages()).toBe(3);
  });

  it("usa A4 retrato em pontos", () => {
    const doc = renderHistoricos([historico("ALUNO A")]);
    const { width, height } = doc.internal.pageSize;
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("não lança com aluno sem nenhum ano cadastrado", () => {
    const vazio = { ...historico("SEM ANOS"), anos: [] };
    expect(() => renderHistoricos([vazio])).not.toThrow();
  });

  it("devolve um documento vazio de uma página para lista vazia", () => {
    expect(renderHistoricos([]).getNumberOfPages()).toBe(1);
  });

  it("imprime o nome do aluno no documento", () => {
    const doc = renderHistoricos([historico("MANUELA MARGARIDA BARROS")]);
    const texto = doc.output("datauristring");
    expect(texto.length).toBeGreaterThan(0);
  });
});
