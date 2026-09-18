import { describe, expect, it } from "vitest";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { COORDENADAS_REFERENCIA, TOLERANCIA_PT } from "./historico-coordenadas";
import { renderHistoricos } from "./historico-pdf";
import type { HistoricoAno, HistoricoData } from "@/lib/historico/tipos";

const ALTURA_A4 = 842;

function anoManuela(serieNome: string, ano: number, diasLetivos: number): HistoricoAno {
  return {
    id: String(ano),
    ano,
    serieId: null,
    serieNome,
    origem: "interna",
    instituicao: "EPG TRINDADE",
    cidade: "TRINDADE",
    uf: "GO",
    resultado: "aprovado",
    mediaAprovacao: 6,
    cargaHoraria: 1000,
    diasLetivos,
    faltas: null,
    percentualFrequencia: null,
    congelado: true,
    notas: [
      { disciplinaId: null, disciplinaNome: "CIÊNCIAS", nota: 9.9, cargaHoraria: null, faltas: null, ordem: 0 }
    ]
  };
}

const MANUELA: HistoricoData = {
  aluno: {
    id: "manuela",
    nome: "MANUELA MARGARIDA BARROS",
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
  anos: [anoManuela("1º ANO", 2024, 213), anoManuela("2º ANO", 2025, 203)],
  observacoes: null
};

/** Extrai {texto, x, y} de cada item do PDF gerado, em coordenadas do modelo. */
async function extrairTextos(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await doc.getPage(1);
  const conteudo = await page.getTextContent();
  return conteudo.items
    .filter((item): item is TextItem => "str" in item)
    .filter((item) => item.str.trim() !== "")
    .map((item) => ({ texto: item.str, x: item.transform[4], y: item.transform[5] }));
}

describe("fidelidade do layout ao modelo de referência", () => {
  it("posiciona cada texto do contrato dentro da tolerância", async () => {
    const doc = renderHistoricos([MANUELA], { dataEmissao: new Date(2026, 8, 17) });
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    const textos = await extrairTextos(bytes);

    const desvios: string[] = [];
    for (const esperado of COORDENADAS_REFERENCIA) {
      const encontrado = textos.find((t) => t.texto.trim() === esperado.texto);
      if (!encontrado) {
        desvios.push(`"${esperado.texto}" não foi encontrado no PDF gerado`);
        continue;
      }
      const dx = Math.abs(encontrado.x - esperado.x);
      const dy = Math.abs(encontrado.y - esperado.y);
      if (dx > TOLERANCIA_PT || dy > TOLERANCIA_PT) {
        desvios.push(
          `"${esperado.texto}": esperado (${esperado.x}, ${esperado.y}), obtido (${encontrado.x.toFixed(1)}, ${encontrado.y.toFixed(1)})`
        );
      }
    }

    expect(desvios).toEqual([]);
  });

  it("gera a página no tamanho A4 do modelo", async () => {
    const doc = renderHistoricos([MANUELA]);
    expect(Math.round(doc.internal.pageSize.height)).toBe(ALTURA_A4);
  });
});
