import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { money } from "@/lib/constants";

export type HoleriteInput = {
  empresa: { nome: string; cnpj: string };
  funcionario: { nome: string; cpf: string; perfil: string };
  competencia: string;
  lancamentos: Array<{
    nome: string;
    referencia: string | null;
    valor: number;
    tipo: string;
  }>;
  bases: { inss: number; irrf: number; fgts: number };
  totais: { proventos: number; descontos: number; liquido: number };
};

function mesLabel(competencia: string): string {
  const [y, m] = competencia.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[Number(m) - 1]}/${y}`;
}

export function gerarHoleritePdf(dados: HoleriteInput): ArrayBuffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const MARGIN = 14;
  const BRAND: [number, number, number] = [27, 63, 184];

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("RECIBO DE PAGAMENTO DE SALÁRIO", pageW / 2, 10, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Competência: ${mesLabel(dados.competencia)}`, pageW / 2, 17, { align: "center" });

  doc.setTextColor(20, 20, 20);

  let y = 28;
  doc.setFillColor(245, 246, 248);
  doc.rect(MARGIN, y, pageW - MARGIN * 2, 22, "F");
  doc.setDrawColor(210, 213, 220);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, pageW - MARGIN * 2, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 130);
  doc.text("EMPRESA", MARGIN + 3, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(dados.empresa.nome, MARGIN + 3, y + 11);
  doc.setFontSize(8);
  doc.setTextColor(80, 90, 110);
  doc.text(`CNPJ: ${dados.empresa.cnpj || "—"}`, MARGIN + 3, y + 17);

  const midX = pageW / 2 + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 130);
  doc.text("FUNCIONÁRIO", midX, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(dados.funcionario.nome, midX, y + 11);
  doc.setFontSize(8);
  doc.setTextColor(80, 90, 110);
  doc.text(`CPF: ${dados.funcionario.cpf || "—"}  ·  ${dados.funcionario.perfil}`, midX, y + 17);

  y += 26;

  const rows = dados.lancamentos
    .filter((l) => l.tipo !== "informativa")
    .map((l) => [
      l.nome,
      l.referencia ?? "",
      l.tipo === "provento" ? money.format(l.valor) : "",
      l.tipo === "desconto" ? money.format(l.valor) : "",
    ]);

  if (rows.length === 0) {
    rows.push(["Nenhum lançamento.", "", "", ""]);
  }

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [200, 205, 215],
      lineWidth: 0.2,
      textColor: 20,
    },
    headStyles: {
      fillColor: BRAND,
      textColor: 255,
      halign: "center",
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 70 },
      1: { halign: "center", cellWidth: 30 },
      2: { halign: "right", fontStyle: "bold" },
      3: { halign: "right", fontStyle: "bold" },
    },
    head: [["Rubrica", "Referência", "Proventos", "Descontos"]],
    body: rows,
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index === 0 || data.column.index === 1) return;
      if (data.column.index === 3) {
        const v = String(data.cell.raw ?? "").trim();
        if (v) data.cell.styles.textColor = [180, 40, 40];
      }
    },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  y = afterTable + 5;
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 90, 110);
  doc.text("BASES DE CÁLCULO", MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(20, 20, 20);
  doc.text(
    `Base INSS: ${money.format(dados.bases.inss)}    Base IRRF: ${money.format(dados.bases.irrf)}    Base FGTS: ${money.format(dados.bases.fgts)}`,
    MARGIN,
    y,
  );

  y += 8;
  doc.setDrawColor(200, 205, 215);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(`Proventos: ${money.format(dados.totais.proventos)}`, MARGIN, y);
  doc.text(`Descontos: ${money.format(dados.totais.descontos)}`, MARGIN + 70, y);

  doc.setFontSize(11);
  doc.setTextColor(...BRAND);
  doc.text(`Líquido: ${money.format(dados.totais.liquido)}`, pageW - MARGIN, y, { align: "right" });

  const pageH = doc.internal.pageSize.getHeight();
  const sigY = pageH - 28;
  doc.setDrawColor(150);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 10, sigY, MARGIN + 80, sigY);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Assinatura do Empregado", MARGIN + 10, sigY + 4);

  doc.line(pageW - 80, sigY, pageW - MARGIN - 10, sigY);
  doc.text("Empregador / Departamento RH", pageW - 80, sigY + 4);

  doc.setFontSize(7);
  doc.text(
    `Emitido em ${new Date().toLocaleDateString("pt-BR")} · ${dados.empresa.nome}`,
    pageW / 2,
    pageH - 6,
    { align: "center" },
  );

  return doc.output("arraybuffer");
}
