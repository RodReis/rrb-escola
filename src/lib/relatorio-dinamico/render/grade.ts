import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DadosRelatorio } from "../tipos";
import { finalizarPaginas, MARGEM_MM, RODAPE_MM, TOPO_CONTEUDO_MM, type CabecalhoDados } from "./cabecalho";

const FONTE = 8;
const PADDING = 1;
const ALTURA_LINHA = FONTE * 0.3528 * 1.15;
const LARGURA_ROTULO = 45;
const ESPACO_BLOCOS = 3;

type ComFinalY = { lastAutoTable: { finalY: number } };

/** Um bloco rótulo|valor por registro; o bloco não é partido entre páginas. */
export function renderGrade(dados: DadosRelatorio, c: CabecalhoDados): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const largura = doc.internal.pageSize.getWidth();
  const limite = doc.internal.pageSize.getHeight() - RODAPE_MM - MARGEM_MM;
  const larguraValor = largura - MARGEM_MM * 2 - LARGURA_ROTULO;
  doc.setFont("times", "normal");
  doc.setFontSize(FONTE);

  let y = TOPO_CONTEUDO_MM;
  for (const linha of dados.linhas) {
    const alturaBloco = linha.reduce((s, v) => {
      const n = Math.max(1, (doc.splitTextToSize(v || " ", larguraValor - PADDING * 2) as string[]).length);
      return s + n * ALTURA_LINHA + PADDING * 2;
    }, 0);
    if (y + alturaBloco > limite && y > TOPO_CONTEUDO_MM) {
      doc.addPage("a4", "portrait");
      y = TOPO_CONTEUDO_MM;
    }
    autoTable(doc, {
      startY: y,
      margin: { top: TOPO_CONTEUDO_MM, bottom: RODAPE_MM + MARGEM_MM, left: MARGEM_MM, right: MARGEM_MM },
      theme: "grid",
      styles: { font: "times", fontSize: FONTE, cellPadding: PADDING, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: LARGURA_ROTULO, fontStyle: "bold" } },
      body: dados.colunas.map((col, i) => [col.label, linha[i] ?? ""]),
    });
    y = (doc as unknown as ComFinalY).lastAutoTable.finalY + ESPACO_BLOCOS;
  }

  if (y + 6 > limite) {
    doc.addPage("a4", "portrait");
    y = TOPO_CONTEUDO_MM;
  }
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(`Quantidade: ${dados.linhas.length}`, MARGEM_MM, y + 4);
  finalizarPaginas(doc, c);
  return doc;
}
