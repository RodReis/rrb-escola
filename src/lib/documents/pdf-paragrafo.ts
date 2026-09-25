import type jsPDF from "jspdf";
import type { Segmento } from "./certificado-texto";

/**
 * Motor de parágrafo justificado, extraído de certificado-pdf.ts para ser
 * reaproveitado pela declaração pedagógica sem duplicar a lógica de quebra
 * de linha e justificação (jsPDF não tem rich text nativo — o texto é uma
 * lista de segmentos com negrito, desenhados palavra a palavra).
 */

export type Palavra = { texto: string; negrito: boolean; largura: number };

export type OpcoesParagrafo = {
  /** Nome da fonte jsPDF (ex.: "times", "helvetica"). */
  fonte: string;
  fonteCorpoPt: number;
  /** Margem lateral em pontos (já convertida de mm, se aplicável). */
  margemPt: number;
};

/** Marcador de quebra de parágrafo forçada (\n no texto original), inserido
 * na lista de "palavras" para `quebrarLinhas` forçar uma nova linha ali —
 * sem essa marcação, o \n vira parte de uma palavra gigante e corrompe a
 * justificação (achado da revisão final: modelos-seed de Transferência têm
 * \n\n separando o corpo do aviso de validade). Nunca aparece dentro de uma
 * linha desenhável: `quebrarLinhas` sempre o consome fechando a linha atual. */
const MARCADOR_QUEBRA = "\n";

/** Mede cada palavra com a fonte do seu segmento — jsPDF não tem rich text. */
export function medirPalavras(doc: jsPDF, segmentos: Segmento[], tamanhoPt: number): Palavra[] {
  doc.setFontSize(tamanhoPt);
  const palavras: Palavra[] = [];

  for (const seg of segmentos) {
    doc.setFont("times", seg.negrito ? "bold" : "normal");
    const paragrafos = seg.texto.split(/\r?\n/);
    paragrafos.forEach((paragrafo, i) => {
      if (i > 0) palavras.push({ texto: MARCADOR_QUEBRA, negrito: seg.negrito, largura: 0 });
      for (const bruta of paragrafo.split(" ")) {
        if (bruta === "") continue;
        palavras.push({ texto: bruta, negrito: seg.negrito, largura: doc.getTextWidth(bruta) });
      }
    });
  }

  return palavras;
}

export function quebrarLinhas(palavras: Palavra[], larguraUtilPt: number, larguraEspacoPt: number): Palavra[][] {
  const linhas: Palavra[][] = [];
  let atual: Palavra[] = [];
  let largura = 0;

  for (const palavra of palavras) {
    if (palavra.texto === MARCADOR_QUEBRA) {
      linhas.push(atual);
      atual = [];
      largura = 0;
      continue;
    }
    const espaco = atual.length === 0 ? 0 : larguraEspacoPt;
    if (atual.length > 0 && largura + espaco + palavra.largura > larguraUtilPt) {
      linhas.push(atual);
      atual = [palavra];
      largura = palavra.largura;
    } else {
      atual.push(palavra);
      largura += espaco + palavra.largura;
    }
  }

  if (atual.length > 0) linhas.push(atual);
  return linhas;
}

/** Altura que `renderCorpo` vai ocupar, sem desenhar nada — para poder
 * centralizar o bloco verticalmente antes de saber onde ele começa. */
export function medirAlturaCorpo(doc: jsPDF, segmentos: Segmento[], opts: OpcoesParagrafo): number {
  if (segmentos.length === 0) return 0;
  const util = doc.internal.pageSize.getWidth() - opts.margemPt * 2;
  const alturaLinha = opts.fonteCorpoPt * 1.9;

  const palavras = medirPalavras(doc, segmentos, opts.fonteCorpoPt);
  doc.setFont(opts.fonte, "normal");
  const larguraEspaco = doc.getTextWidth(" ") * 1.6;
  const linhas = quebrarLinhas(palavras, util, larguraEspaco);

  return linhas.length * alturaLinha;
}

/**
 * Parágrafo justificado, palavra a palavra. A sobra de cada linha é
 * distribuída nos vãos; a última fica alinhada à esquerda.
 */
export function renderCorpo(doc: jsPDF, yInicial: number, segmentos: Segmento[], opts: OpcoesParagrafo): number {
  if (segmentos.length === 0) return yInicial;

  const util = doc.internal.pageSize.getWidth() - opts.margemPt * 2;
  const alturaLinha = opts.fonteCorpoPt * 1.9;

  doc.setTextColor(0, 0, 0);
  const palavras = medirPalavras(doc, segmentos, opts.fonteCorpoPt);

  // A fonte core "times" do jsPDF mede o glifo de espaço mais estreito do
  // que aparenta visualmente — sem esse reforço o texto sai quase colado.
  doc.setFont(opts.fonte, "normal");
  const larguraEspaco = doc.getTextWidth(" ") * 1.6;
  const linhas = quebrarLinhas(palavras, util, larguraEspaco);

  let y = yInicial;
  linhas.forEach((linha, i) => {
    const somaPalavras = linha.reduce((soma, p) => soma + p.largura, 0);
    const vaos = linha.length - 1;
    const ultima = i === linhas.length - 1;
    const espaco = ultima || vaos === 0 ? larguraEspaco : (util - somaPalavras) / vaos;

    let x = opts.margemPt;
    for (const palavra of linha) {
      doc.setFont(opts.fonte, palavra.negrito ? "bold" : "normal");
      doc.text(palavra.texto, x, y);
      x += palavra.largura + espaco;
    }
    y += alturaLinha;
  });

  return y;
}
