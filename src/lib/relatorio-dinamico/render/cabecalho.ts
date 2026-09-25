import type jsPDF from "jspdf";

export type ImagemPdf = { data: string; w: number; h: number };
export type CabecalhoDados = {
  titulo: string;
  subtitulo?: string;
  empresaNome: string | null;
  resolucao: string | null;
  logos: ImagemPdf[];
  emitidoEm: Date;
  descricao?: string;
};

export const MARGEM_MM = 10;
export const ALTURA_CABECALHO_MM = 30;
export const RODAPE_MM = 12;
const ALTURA_LOGO_MM = 18;
const GAP_LOGO_MM = 3;

/** Logos lado a lado, altura fixa e largura proporcional; se não couberem em
 * `larguraMax`, todas encolhem pelo mesmo fator. */
export function layoutLogos(
  logos: { w: number; h: number }[],
  alturaMax: number,
  larguraMax: number,
  gap: number
): { x: number; w: number; h: number }[] {
  if (logos.length === 0) return [];
  const larguras = logos.map((l) => (l.w / l.h) * alturaMax);
  const total = larguras.reduce((s, w) => s + w, 0) + gap * (logos.length - 1);
  const fator = total > larguraMax ? (larguraMax - gap * (logos.length - 1)) / (total - gap * (logos.length - 1)) : 1;
  let x = 0;
  return larguras.map((w) => {
    const item = { x, w: w * fator, h: alturaMax * fator };
    x += item.w + gap;
    return item;
  });
}

function fmtDataHora(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function desenharCabecalho(doc: jsPDF, c: CabecalhoDados): void {
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM_MM;
  const posicoes = layoutLogos(c.logos, ALTURA_LOGO_MM, largura * 0.4, GAP_LOGO_MM);
  posicoes.forEach((p, i) => {
    const img = c.logos[i];
    const formato = img.data.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(img.data, formato, MARGEM_MM + p.x, MARGEM_MM, p.w, p.h, undefined, "FAST");
  });

  doc.setTextColor(0, 0, 0);
  let y = MARGEM_MM + 3;
  if (c.empresaNome) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(c.empresaNome.toUpperCase(), direita, y, { align: "right" });
    y += 4;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  if (c.resolucao) {
    doc.text(c.resolucao, direita, y, { align: "right" });
    y += 3.5;
  }
  doc.text(fmtDataHora(c.emitidoEm), direita, y, { align: "right" });

  const centro = largura / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(c.titulo, centro, MARGEM_MM + 22, { align: "center" });
  if (c.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(c.subtitulo, centro, MARGEM_MM + 26.5, { align: "center" });
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(MARGEM_MM, MARGEM_MM + ALTURA_CABECALHO_MM - 2, direita, MARGEM_MM + ALTURA_CABECALHO_MM - 2);
}

function desenharRodape(doc: jsPDF, pagina: number, total: number, descricao?: string): void {
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const y = altura - MARGEM_MM + 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(MARGEM_MM, y - 4, largura - MARGEM_MM, y - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  if (descricao) doc.text(descricao, MARGEM_MM, y);
  doc.text(`${pagina}/${total}`, largura / 2, y, { align: "center" });
}

/** Pós-processamento: cabeçalho + rodapé em todas as páginas (total só é conhecido no fim). */
export function finalizarPaginas(doc: jsPDF, c: CabecalhoDados): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    desenharCabecalho(doc, c);
    desenharRodape(doc, i, total, c.descricao?.trim() || undefined);
  }
}

export const TOPO_CONTEUDO_MM = MARGEM_MM + ALTURA_CABECALHO_MM;
