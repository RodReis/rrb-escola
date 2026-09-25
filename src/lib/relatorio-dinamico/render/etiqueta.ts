import jsPDF from "jspdf";
import type { DadosRelatorio, ModeloEtiqueta } from "../tipos";
import { MODELOS_ETIQUETA, posicaoEtiqueta } from "./modelos-etiqueta";

const PADDING_MM = 1.5;
const PT_EM_MM = 0.3528;
const ENTRELINHA = 1.15;

export function linhasEtiqueta(dados: DadosRelatorio, linha: string[], rotulos: boolean): string[] {
  return dados.colunas.map((c, i) => (rotulos ? `${c.label}: ${linha[i] ?? ""}` : linha[i] ?? ""));
}

/** Corta o texto (sem quebra de linha) até caber em `largura`, como no Escolar Manager. */
export function truncarParaLargura(medir: (s: string) => number, texto: string, largura: number): string {
  if (medir(texto) <= largura) return texto;
  let fim = texto.length;
  while (fim > 0 && medir(texto.slice(0, fim)) > largura) fim -= 1;
  return texto.slice(0, fim);
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
  const maxLinhas = Math.max(1, Math.floor((m.altura - PADDING_MM * 2) / alturaLinha));
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
        doc.text(truncarParaLargura(medir, texto, larguraUtil), pos.x + PADDING_MM, y);
      });
  });
  rodape();
  return doc;
}
