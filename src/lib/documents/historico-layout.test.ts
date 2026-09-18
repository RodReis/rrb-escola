import { describe, expect, it } from "vitest";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { renderHistoricos } from "./historico-pdf";
import type { HistoricoAno, HistoricoData, NivelEnsino } from "@/lib/historico/tipos";
import { SERIES_POR_NIVEL } from "@/lib/historico/tipos";

const ALTURA_A4 = 842;

/**
 * Histórico sintético com N disciplinas em todas as séries do nível — o caso
 * que quebrava: a grade crescia para baixo sobre o rodapé, que era fixo.
 */
function historicoCom(nDisciplinas: number, nivel: NivelEnsino = "fund1"): HistoricoData {
  const exibeCh = nivel === "fund2" || nivel === "medio";
  const notas = Array.from({ length: nDisciplinas }, (_, i) => ({
    disciplinaId: null,
    disciplinaNome: `DISCIPLINA DE NOME BEM LONGO ${i + 1}`,
    nota: 9.5,
    cargaHoraria: exibeCh ? 160 : null,
    faltas: null,
    ordem: i
  }));

  const anos: HistoricoAno[] = SERIES_POR_NIVEL[nivel].map((serieNome, i) => ({
    id: String(i),
    ano: 2020 + i,
    serieId: null,
    serieNome,
    origem: "interna",
    instituicao: "EPG TRINDADE",
    cidade: "TRINDADE",
    uf: "GO",
    resultado: "aprovado",
    mediaAprovacao: 6,
    cargaHoraria: 1000,
    diasLetivos: 203,
    faltas: null,
    percentualFrequencia: null,
    congelado: true,
    notas
  }));

  return {
    aluno: {
      id: "teste",
      nome: "ALUNO DE TESTE COM NOME BASTANTE COMPRIDO",
      cpf: "000.000.000-00",
      matricula: "9999",
      filiacao: "PAI DE TAL e MAE DE TAL",
      dataNascimento: "01/01/2015",
      naturalidade: "GOIÂNIA / GO",
      nacionalidade: "BRASILEIRA",
      rg: "1234567",
      orgaoExpedidor: "SSP GO",
      dataExpedicao: "01/01/2020"
    },
    nivel,
    credenciamento: {
      razaoSocial: "ESCOLA PINGUINHO DE GENTE LTDA",
      nomeFantasia: "EPG TRINDADE",
      cnpj: "11.714.876/0001-16",
      resolucao: "RENOVAÇÃO DE RECONHECIMENTO, RESOLUÇÃO CEE/CEB Nº 518/2024",
      endereco: "RUA EUGÊNIO JARDIM Nº 473, CENTRO, TRINDADE - GO CEP: 75388-686",
      cidade: "TRINDADE",
      uf: "GO",
      cep: "75388-686",
      telefones: "(62)3505-1531",
      email: "secretariaepgtrindade@gmail.com",
      logoPath: null,
      secretarioNome: "ROSSANIA BRÍGIDA RODRIGUES RIBEIRO BARBOSA",
      secretarioCargo: "Secretário(a)",
      diretorNome: "RAFAELA MACHADO MARGARIDA BARROS",
      diretorCargo: "Diretor(a)"
    },
    anos,
    observacoes: null
  };
}

/** Itens de texto com y no eixo do modelo (origem embaixo). */
async function textos(dados: HistoricoData) {
  const doc = renderHistoricos([dados], { dataEmissao: new Date(2026, 8, 18) });
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const conteudo = await page.getTextContent();
  return conteudo.items
    .filter((i): i is TextItem => "str" in i)
    .filter((i) => i.str.trim() !== "")
    .map((i) => ({ texto: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
}

const yDe = (itens: Awaited<ReturnType<typeof textos>>, alvo: string) =>
  itens.find((i) => i.texto.startsWith(alvo))?.y;

describe("layout da grade não colide com o conteúdo abaixo", () => {
  // 21 disciplinas é o máximo real da base importada; com âncoras fixas em
  // y=401 o rodapé da grade era escrito por cima das últimas disciplinas.
  for (const n of [1, 14, 21]) {
    it(`mantém a ordem vertical dos blocos com ${n} disciplinas`, async () => {
      const itens = await textos(historicoCom(n));

      const ultimaDisciplina = itens
        .filter((i) => i.texto.startsWith("DISCIPLINA DE NOME"))
        .reduce((menor, i) => Math.min(menor, i.y), Infinity);
      const resultadoFinal = yDe(itens, "Resultado Final");
      const diasLetivos = yDe(itens, "Dias Letivos");
      const cabecalhoSerie = yDe(itens, "Série");
      const assinatura = yDe(itens, "ROSSANIA");

      expect(resultadoFinal).toBeDefined();
      expect(cabecalhoSerie).toBeDefined();
      expect(assinatura).toBeDefined();

      // y maior = mais alto na página: cada bloco fica estritamente abaixo do anterior.
      expect(resultadoFinal!).toBeLessThan(ultimaDisciplina);
      expect(diasLetivos!).toBeLessThan(resultadoFinal!);
      expect(cabecalhoSerie!).toBeLessThan(diasLetivos!);
      expect(assinatura!).toBeLessThan(cabecalhoSerie!);
    });
  }

  it("cabe na página mesmo no caso mais denso", async () => {
    const itens = await textos(historicoCom(21, "fund2"));
    const menorY = Math.min(...itens.map((i) => i.y));
    expect(menorY).toBeGreaterThan(0);
    expect(Math.max(...itens.map((i) => i.y))).toBeLessThan(ALTURA_A4);
  });

  it("desenha réguas: o PDF tem operadores de linha além do texto", async () => {
    const doc = renderHistoricos([historicoCom(5)], { dataEmissao: new Date(2026, 8, 18) });
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const ops = await (await pdf.getPage(1)).getOperatorList();
    const { OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const desenhos = ops.fnArray.filter(
      (fn) => fn === OPS.stroke || fn === OPS.constructPath
    ).length;
    expect(desenhos).toBeGreaterThan(20);
  });
});
