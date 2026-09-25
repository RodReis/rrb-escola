import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DadosRelatorio } from "../tipos";
import { finalizarPaginas, MARGEM_MM, RODAPE_MM, TOPO_CONTEUDO_MM, type CabecalhoDados } from "./cabecalho";

type ComFinalY = { lastAutoTable: { finalY: number } };

/** Uma linha por registro, uma coluna por campo; cabeçalho de colunas repetido por página. */
export function renderTabular(dados: DadosRelatorio, c: CabecalhoDados): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  autoTable(doc, {
    startY: TOPO_CONTEUDO_MM,
    margin: { top: TOPO_CONTEUDO_MM, bottom: RODAPE_MM + MARGEM_MM, left: MARGEM_MM, right: MARGEM_MM },
    theme: "grid",
    showHead: "everyPage",
    styles: { font: "times", fontSize: 7.5, cellPadding: 1, overflow: "linebreak", textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    head: [dados.colunas.map((col) => col.label)],
    body: dados.linhas,
  });
  const limite = doc.internal.pageSize.getHeight() - RODAPE_MM - MARGEM_MM;
  let y = (doc as unknown as ComFinalY).lastAutoTable.finalY + 5;
  if (y > limite) {
    doc.addPage("a4", "landscape");
    y = TOPO_CONTEUDO_MM + 4;
  }
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(`Quantidade: ${dados.linhas.length}`, MARGEM_MM, y);
  finalizarPaginas(doc, c);
  return doc;
}
