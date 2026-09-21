import { describe, expect, it } from "vitest";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { COORDENADAS_REFERENCIA, SOMENTE_Y, TOLERANCIA_PT } from "./historico-coordenadas";
import { renderHistoricos } from "./historico-pdf";
import type { HistoricoAno, HistoricoData } from "@/lib/historico/tipos";

const LARGURA_A4_PAISAGEM = 842;

function anoVitoria(serieNome: string, ano: number, diasLetivos: number): HistoricoAno {
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
      { disciplinaId: null, disciplinaNome: "MATEMÁTICA", nota: 9.4, cargaHoraria: 280, faltas: null, ordem: 0 }
    ]
  };
}

// Aluna de nível médio: as âncoras do contrato ("1ª/2ª/3ª SÉRIE - EM") vêm do
// verso do CERTIFICADO.pdf de referência, que é justamente um certificado de
// conclusão do Ensino Médio.
const VITORIA: HistoricoData = {
  aluno: {
    id: "vitoria",
    nome: "VITÓRIA VIEIRA VÍTOR",
    cpf: "116.726.301-42",
    matricula: "1041",
    filiacao: "JANIRO VIEIRA DA COSTA e MARIA JOSÉ DA SILVA VITOR",
    dataNascimento: "2006-11-22",
    naturalidade: "GOIÂNIA-GO",
    nacionalidade: "BRASILEIRA",
    rg: "6063621",
    orgaoExpedidor: "PC/GO",
    dataExpedicao: null
  },
  nivel: "medio",
  credenciamento: {
    razaoSocial: "COLÉGIO INTEGRADO EPG LTDA-ME",
    nomeFantasia: "EPG TRINDADE",
    cnpj: "35.027.047/0001-23",
    resolucao: "RESOLUÇÃO CEE/CEB Nº 518/2024",
    endereco: "RUA EUGÊNIO JARDIM, 473, SALA 02, CENTRO",
    cidade: "TRINDADE",
    uf: "GO",
    cep: "75388-686",
    telefones: "(62)3505-1531",
    email: "secretariaepgtrindade@gmail.com",
    logoPath: null,
    secretarioNome: "ROSSANIA BRÍGIDA RODRIGUES RIBEIRO BARBOSA",
    secretarioCargo: "Secretário(a)",
    diretorNome: "RAFAELA MARGARIDA BARROS",
    diretorCargo: "Diretor(a)"
  },
  anos: [
    anoVitoria("1ª SÉRIE", 2022, 213),
    anoVitoria("2ª SÉRIE", 2023, 209),
    anoVitoria("3ª SÉRIE", 2024, 214)
  ],
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
    const doc = renderHistoricos([VITORIA], { dataEmissao: new Date(2026, 8, 17) });
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    const textos = await extrairTextos(bytes);

    const desvios: string[] = [];
    for (const esperado of COORDENADAS_REFERENCIA) {
      const encontrado = textos.find((t) => t.texto.trim() === esperado.texto);
      if (!encontrado) {
        desvios.push(`"${esperado.texto}" não foi encontrado no PDF gerado`);
        continue;
      }
      // Rótulo centrado na célula segue a largura da faixa, não um x literal.
      const dx = SOMENTE_Y.has(esperado.texto) ? 0 : Math.abs(encontrado.x - esperado.x);
      const dy = Math.abs(encontrado.y - esperado.y);
      if (dx > TOLERANCIA_PT || dy > TOLERANCIA_PT) {
        desvios.push(
          `"${esperado.texto}": esperado (${esperado.x}, ${esperado.y}), obtido (${encontrado.x.toFixed(1)}, ${encontrado.y.toFixed(1)})`
        );
      }
    }

    expect(desvios).toEqual([]);
  });

  it("gera a página no tamanho A4 paisagem do modelo", async () => {
    const doc = renderHistoricos([VITORIA]);
    expect(Math.round(doc.internal.pageSize.width)).toBe(LARGURA_A4_PAISAGEM);
  });
});
