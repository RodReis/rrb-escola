import jsPDF from "jspdf";
import type { DadosRelatorio, ModeloEtiqueta } from "../tipos";
import { MODELOS_ETIQUETA, type ModeloEtiquetaDef, posicaoEtiqueta } from "./modelos-etiqueta";

export const PADDING_MM = 1.5;
const PT_EM_MM = 0.3528;
const ENTRELINHA = 1.15;

export function linhasEtiqueta(dados: DadosRelatorio, linha: string[], rotulos: boolean): string[] {
  return dados.colunas.map((c, i) => (rotulos ? `${c.label}: ${linha[i] ?? ""}` : linha[i] ?? ""));
}

/** Quantas linhas de texto cabem na altura útil da etiqueta, numa fonte
 * dada — mesmo cálculo usado para desenhar e para avisar na UI quando o
 * usuário escolheu mais colunas do que cabem fisicamente na etiqueta. */
export function linhasQueCabem(modelo: ModeloEtiquetaDef, fonte: number): number {
  const alturaLinha = fonte * PT_EM_MM * ENTRELINHA;
  return Math.max(1, Math.floor((modelo.altura - PADDING_MM * 2) / alturaLinha));
}

const RETICENCIAS = "…";

/**
 * Corta o texto (sem quebra de linha) até caber em `largura`, como no Escolar
 * Manager. Com `reticencias: true`, sinaliza o corte com "…" sem estourar a
 * largura (reserva o espaço do indicador antes de medir o restante) — usado
 * no corpo da etiqueta, onde um nome cortado sem aviso lê como o nome
 * completo (ex.: "Carlos Antônio Ca" parece ser o nome inteiro).
 */
export function truncarParaLargura(
  medir: (s: string) => number,
  texto: string,
  largura: number,
  opts?: { reticencias?: boolean }
): string {
  if (medir(texto) <= largura) return texto;
  if (!opts?.reticencias) {
    let fim = texto.length;
    while (fim > 0 && medir(texto.slice(0, fim)) > largura) fim -= 1;
    return texto.slice(0, fim);
  }
  const larguraReticencias = medir(RETICENCIAS);
  if (larguraReticencias > largura) return ""; // nem o indicador cabe
  let fim = texto.length;
  while (fim > 0 && medir(texto.slice(0, fim)) + larguraReticencias > largura) fim -= 1;
  return fim > 0 ? texto.slice(0, fim) + RETICENCIAS : RETICENCIAS;
}

export function renderEtiquetas(
  dados: DadosRelatorio,
  opts: { modelo: ModeloEtiqueta; fonte: number; rotulos: boolean; descricao?: string }
): jsPDF {
  const m = MODELOS_ETIQUETA[opts.modelo];
  const doc = new jsPDF({ unit: "mm", format: m.papel, orientation: "portrait" });
  doc.setFont("courier", "normal");
  doc.setFontSize(opts.fonte);
  const alturaLinha = opts.fonte * PT_EM_MM * ENTRELINHA;
  const larguraUtil = m.largura - PADDING_MM * 2;
  const maxLinhas = linhasQueCabem(m, opts.fonte);
  const medir = (s: string) => doc.getTextWidth(s);
  const descricao = opts.descricao?.trim();

  let paginaAtual = 0;
  const rodape = () => {
    if (!descricao) return;
    doc.setFontSize(7);
    doc.text(truncarParaLargura(medir, descricao, m.paginaW - 10), m.paginaW / 2, m.paginaH - 3, { align: "center" });
    doc.setFontSize(opts.fonte);
  };

  dados.linhas.forEach((linha, i) => {
    const pos = posicaoEtiqueta(m, i);
    if (pos.pagina > paginaAtual) {
      rodape();
      doc.addPage(m.papel, "portrait");
      paginaAtual = pos.pagina;
    }
    linhasEtiqueta(dados, linha, opts.rotulos)
      .slice(0, maxLinhas)
      .forEach((texto, l) => {
        const y = pos.y + PADDING_MM + alturaLinha * (l + 1) - alturaLinha * 0.25;
        doc.text(truncarParaLargura(medir, texto, larguraUtil, { reticencias: true }), pos.x + PADDING_MM, y);
      });
  });
  rodape();
  return doc;
}
