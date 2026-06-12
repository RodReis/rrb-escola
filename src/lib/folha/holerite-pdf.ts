import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { money } from "@/lib/constants";

export type HoleriteInput = {
  empresa: { nome: string; cnpj: string };
  funcionario: {
    codigo: string;
    nome: string;
    cpf: string;
    cargo: string;
    cbo: string;
    admissao: string;
  };
  competencia: string;
  tipoFolha: string;
  lancamentos: Array<{
    codigo: string;
    nome: string;
    tipo: string;
    referencia: string | null;
    valor: number;
  }>;
  bases: {
    inss: number;
    irrf: number;
    fgts: number;
    salarioBase: number | null;
    faixaIrrf: number | null;
  };
  totais: {
    vencimentos: number;
    descontos: number;
    liquido: number;
    fgtsMes: number;
  };
};

function mesLabel(competencia: string): string {
  const [y, m] = competencia.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[Number(m) - 1]}/${y}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmt(v: number): string {
  return money.format(v);
}

function pct(v: number, decimals = 2): string {
  return v.toFixed(decimals).replace(".", ",");
}

function buildReferencia(
  tipo: string,
  codigo: string,
  storedRef: string | null,
  valor: number,
  bases: HoleriteInput["bases"],
): string {
  if (tipo === "desconto") {
    const cd = codigo.toLowerCase();

    if (cd === "inss" || cd.startsWith("inss")) {
      const base = bases.inss;
      if (base > 0 && valor > 0) {
        const aliq = (valor / base) * 100;
        return pct(aliq) + "%";
      }
    }

    if (cd === "irrf" || cd.startsWith("irrf")) {
      if (bases.faixaIrrf != null && bases.faixaIrrf > 0) {
        return pct(bases.faixaIrrf) + "%";
      }
    }

    if (cd === "sindicato" || cd.includes("sindic")) {
      if (storedRef) return storedRef;
      return "3,33%";
    }

    if (cd === "dsr" || cd.includes("dsr")) {
      if (storedRef) return storedRef;
      return "16,67%";
    }
  }

  return storedRef ?? "";
}

export function gerarHoleritePdf(dados: HoleriteInput): ArrayBuffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const MARGIN = 12;
  const BRAND: [number, number, number] = [27, 63, 184];
  const GRAY_BG: [number, number, number] = [245, 246, 248];
  const BORDER: [number, number, number] = [210, 213, 220];
  const TEXT_MUTED: [number, number, number] = [100, 110, 130];
  const TEXT_MAIN: [number, number, number] = [20, 20, 20];
  const RED: [number, number, number] = [180, 40, 40];

  const contentW = pageW - MARGIN * 2;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(dados.tipoFolha.toUpperCase(), pageW / 2, 10, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Competência: ${mesLabel(dados.competencia)}`,
    pageW / 2,
    17,
    { align: "center" },
  );

  let y = 30;

  const empresaBlockH = 22;
  doc.setFillColor(...GRAY_BG);
  doc.rect(MARGIN, y, contentW, empresaBlockH, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.rect(MARGIN, y, contentW, empresaBlockH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("EMPRESA", MARGIN + 3, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT_MAIN);
  doc.text(dados.empresa.nome, MARGIN + 3, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 90, 110);
  doc.text(`CNPJ: ${dados.empresa.cnpj || "—"}`, MARGIN + 3, y + 17);

  y += empresaBlockH + 4;

  const funcBlockH = 34;
  doc.setFillColor(...GRAY_BG);
  doc.rect(MARGIN, y, contentW, funcBlockH, "F");
  doc.setDrawColor(...BORDER);
  doc.rect(MARGIN, y, contentW, funcBlockH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("FUNCIONÁRIO", MARGIN + 3, y + 5);

  const halfW = contentW / 2 - 3;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Código", MARGIN + 3, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MAIN);
  doc.text(dados.funcionario.codigo || "—", MARGIN + 3, y + 17);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Nome", MARGIN + 22, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MAIN);
  doc.text(dados.funcionario.nome, MARGIN + 22, y + 17);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("CPF", MARGIN + 3, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MAIN);
  doc.text(dados.funcionario.cpf || "—", MARGIN + 3, y + 30);

  const col2X = MARGIN + halfW + 6;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Cargo", col2X, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MAIN);
  doc.text(dados.funcionario.cargo || "—", col2X, y + 17);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("CBO", col2X + 50, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MAIN);
  doc.text(dados.funcionario.cbo || "—", col2X + 50, y + 17);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Admissão", col2X, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MAIN);
  doc.text(dados.funcionario.admissao || "—", col2X, y + 30);

  y += funcBlockH + 5;

  const tableRows = dados.lancamentos
    .filter((l) => l.tipo !== "informativa")
    .map((l) => {
      const ref = buildReferencia(l.tipo, l.codigo, l.referencia, l.valor, dados.bases);
      const venc = l.tipo === "provento" ? fmt(l.valor) : "";
      const desc = l.tipo === "desconto" ? fmt(l.valor) : "";
      return [l.codigo, l.nome, ref, venc, desc];
    });

  if (tableRows.length === 0) {
    tableRows.push(["—", "Nenhum lançamento.", "", "", ""]);
  }

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      lineColor: [...BORDER] as [number, number, number],
      lineWidth: 0.2,
      textColor: 20,
    },
    headStyles: {
      fillColor: [...BRAND] as [number, number, number],
      textColor: 255,
      halign: "center",
      fontStyle: "bold",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 18 },
      1: { halign: "left", cellWidth: "auto" },
      2: { halign: "center", cellWidth: 24 },
      3: { halign: "right", cellWidth: 32, fontStyle: "bold" },
      4: { halign: "right", cellWidth: 32, fontStyle: "bold" },
    },
    head: [["Código", "Descrição", "Referência", "Vencimentos", "Descontos"]],
    body: tableRows,
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 4) {
        const v = String(data.cell.raw ?? "").trim();
        if (v) data.cell.styles.textColor = [...RED] as [number, number, number];
      }
    },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  y = afterTable + 6;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 5;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("RODAPÉ — BASES E TOTAIS", MARGIN, y);
  y += 5;

  const basesData: [string, string][] = [
    ["Salário Base", dados.bases.salarioBase != null && dados.bases.salarioBase > 0 ? fmt(dados.bases.salarioBase) : "—"],
    ["Sal. Contr. INSS (Base INSS)", fmt(dados.bases.inss)],
    ["Base Cálc. FGTS", fmt(dados.bases.fgts)],
    ["FGTS do Mês (8%)", fmt(dados.totais.fgtsMes)],
    ["Base Cálc. IRRF", fmt(dados.bases.irrf)],
    ["Faixa IRRF", dados.bases.faixaIrrf != null && dados.bases.faixaIrrf > 0 ? pct(dados.bases.faixaIrrf) + "%" : "—"],
  ];

  const colLW = 80;
  const colVW = 36;
  const basesPerRow = 3;
  const rowH = 8;

  for (let i = 0; i < basesData.length; i++) {
    const col = i % basesPerRow;
    const row = Math.floor(i / basesPerRow);
    const bx = MARGIN + col * (colLW + colVW + 4);
    const by = y + row * rowH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(basesData[i][0], bx, by);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MAIN);
    doc.text(basesData[i][1], bx, by + 4.5);
  }

  const basesRows = Math.ceil(basesData.length / basesPerRow);
  y += basesRows * rowH + 4;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 6;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MAIN);
  doc.text(`Vencimentos: ${fmt(dados.totais.vencimentos)}`, MARGIN, y);

  doc.setTextColor(...RED);
  doc.text(`Descontos: ${fmt(dados.totais.descontos)}`, MARGIN + 75, y);

  doc.setFontSize(11);
  doc.setTextColor(...BRAND);
  doc.text(`Líquido: ${fmt(dados.totais.liquido)}`, pageW - MARGIN, y, { align: "right" });

  const pageH = doc.internal.pageSize.getHeight();
  const sigY = pageH - 28;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.25);
  doc.line(MARGIN + 5, sigY, MARGIN + 80, sigY);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Assinatura do Empregado", MARGIN + 5, sigY + 4);

  doc.line(pageW - 90, sigY, pageW - MARGIN - 5, sigY);
  doc.text("Empregador / Departamento RH", pageW - 90, sigY + 4);

  doc.setFontSize(6.5);
  doc.text(
    `Emitido em ${new Date().toLocaleDateString("pt-BR")} · ${dados.empresa.nome}`,
    pageW / 2,
    pageH - 6,
    { align: "center" },
  );

  return doc.output("arraybuffer");
}

export { formatDate };
