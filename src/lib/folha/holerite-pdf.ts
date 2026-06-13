import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { money } from "@/lib/constants";
import { valorPorExtenso } from "@/lib/folha/extenso";

export type HoleriteOpcoes = {
  titulo: string;
  assinatura?: boolean;
  cabecalhoExtra?: string[];
  ferias?: {
    periodoAquisitivo: string;
    gozo: string;
    empresaEndereco?: string;
    empresaCidade?: string;
  };
};

export type HoleriteInput = {
  empresa: { nome: string; cnpj: string; endereco?: string; cidade?: string };
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

export function gerarHoleritePdf(dados: HoleriteInput, opcoes?: HoleriteOpcoes): ArrayBuffer {
  if (opcoes?.ferias) {
    return gerarReciboDeFeriasPdf(dados, opcoes);
  }
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

  const titulo = opcoes?.titulo ?? dados.tipoFolha;
  const cabecalhoExtra = opcoes?.cabecalhoExtra ?? [];
  const headerH = cabecalhoExtra.length > 0 ? 24 + cabecalhoExtra.length * 6 : 24;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(titulo.toUpperCase(), pageW / 2, 10, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Competência: ${mesLabel(dados.competencia)}`,
    pageW / 2,
    17,
    { align: "center" },
  );
  for (let i = 0; i < cabecalhoExtra.length; i++) {
    doc.text(cabecalhoExtra[i], pageW / 2, 23 + i * 6, { align: "center" });
  }

  let y = headerH + 6;

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
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);

  doc.line(MARGIN + 5, sigY, MARGIN + 80, sigY);
  doc.text("Assinatura do Empregado", MARGIN + 5, sigY + 4);

  if (!(opcoes?.assinatura)) {
    doc.line(pageW - 90, sigY, pageW - MARGIN - 5, sigY);
    doc.text("Empregador / Departamento RH", pageW - 90, sigY + 4);
  }

  doc.setFontSize(6.5);
  doc.text(
    `Emitido em ${new Date().toLocaleDateString("pt-BR")} · ${dados.empresa.nome}`,
    pageW / 2,
    pageH - 6,
    { align: "center" },
  );

  return doc.output("arraybuffer");
}

function gerarReciboDeFeriasPdf(dados: HoleriteInput, opcoes: HoleriteOpcoes): ArrayBuffer {
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

  const ferias = opcoes.ferias!;

  function sectionTitle(text: string, y: number): number {
    doc.setFillColor(...BRAND);
    doc.rect(MARGIN, y, contentW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(text, MARGIN + 3, y + 5);
    return y + 10;
  }

  function labelValue(label: string, value: string, x: number, y: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MAIN);
    doc.text(value, x, y + 4.5);
  }

  let y = 12;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("AVISO PRÉVIO DE FÉRIAS", pageW / 2, 7, { align: "center" });
  y = 15;

  doc.setFillColor(...GRAY_BG);
  doc.rect(MARGIN, y, contentW, 18, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, contentW, 18);

  const halfW = contentW / 2;
  labelValue("Empresa / Razão Social", dados.empresa.nome, MARGIN + 3, y + 5);
  labelValue("CNPJ", dados.empresa.cnpj || "—", MARGIN + 3, y + 13);
  labelValue("Funcionário", dados.funcionario.nome, MARGIN + halfW + 3, y + 5);
  labelValue("CPF", dados.funcionario.cpf || "—", MARGIN + halfW + 3, y + 13);
  y += 22;

  const col3 = contentW / 3;
  doc.setFillColor(...GRAY_BG);
  doc.rect(MARGIN, y, contentW, 14, "F");
  doc.setDrawColor(...BORDER);
  doc.rect(MARGIN, y, contentW, 14);
  labelValue("Período Aquisitivo", ferias.periodoAquisitivo, MARGIN + 3, y + 5);
  labelValue("Gozo", ferias.gozo, MARGIN + col3 + 3, y + 5);
  labelValue("Cargo", dados.funcionario.cargo || "—", MARGIN + col3 * 2 + 3, y + 5);
  labelValue("Admissão", dados.funcionario.admissao || "—", MARGIN + col3 * 2 + 3, y + 12);
  y += 18;

  y = sectionTitle("PROVENTOS E DESCONTOS", y);

  const proventos = dados.lancamentos.filter((l) => l.tipo === "provento" && l.valor > 0);
  const descontos = dados.lancamentos.filter((l) => l.tipo === "desconto" && l.valor > 0);

  const tableRows = [
    ...proventos.map((l) => [l.codigo, l.nome, l.referencia ?? "", fmt(l.valor), ""]),
    ...descontos.map((l) => [l.codigo, l.nome, l.referencia ?? "", "", fmt(l.valor)]),
  ];
  if (tableRows.length === 0) tableRows.push(["—", "Nenhum lançamento.", "", "", ""]);

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      lineColor: [...BORDER] as [number, number, number],
      lineWidth: 0.2,
      textColor: 20,
    },
    headStyles: {
      fillColor: [...BRAND] as [number, number, number],
      textColor: 255,
      halign: "center",
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 18 },
      1: { halign: "left", cellWidth: "auto" },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "right", cellWidth: 28, fontStyle: "bold" },
      4: { halign: "right", cellWidth: 28, fontStyle: "bold" },
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

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 5;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MAIN);
  doc.text(`Vencimentos: ${fmt(dados.totais.vencimentos)}`, MARGIN, y);
  doc.setTextColor(...RED);
  doc.text(`Descontos: ${fmt(dados.totais.descontos)}`, MARGIN + 70, y);
  doc.setFontSize(10);
  doc.setTextColor(...BRAND);
  doc.text(`Líquido: ${fmt(dados.totais.liquido)}`, pageW - MARGIN, y, { align: "right" });
  y += 8;

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...TEXT_MUTED);
  const legalText =
    "O empregado deverá ser notificado do início das férias com antecedência mínima de 30 (trinta) dias, " +
    "nos termos do art. 135 da CLT. O pagamento das férias deve ser efetuado até 2 (dois) dias antes do início do gozo.";
  const legalLines = doc.splitTextToSize(legalText, contentW);
  doc.text(legalLines, MARGIN, y);
  y += legalLines.length * 3.5 + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MAIN);
  doc.text("CIENTE:", MARGIN, y);
  y += 8;

  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.25);
  doc.line(MARGIN + 5, y, MARGIN + 80, y);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Assinatura do Empregado", MARGIN + 5, y + 3.5);

  doc.line(pageW - 90, y, pageW - MARGIN - 5, y);
  doc.text("Assinatura do Empregador / RH", pageW - 90, y + 3.5);
  y += 12;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 6;

  doc.setFillColor(...BRAND);
  doc.rect(0, y - 2, pageW, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("RECIBO DE FÉRIAS — QUITAÇÃO", pageW / 2, y + 5, { align: "center" });
  y += 14;

  doc.setFillColor(...GRAY_BG);
  doc.rect(MARGIN, y, contentW, 22, "F");
  doc.setDrawColor(...BORDER);
  doc.rect(MARGIN, y, contentW, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MAIN);

  const endereco = ferias.empresaEndereco ?? dados.empresa.endereco ?? "";
  const cidade = ferias.empresaCidade ?? dados.empresa.cidade ?? "";
  const enderecoStr = [endereco, cidade].filter(Boolean).join(" — ");

  const quitacaoText =
    `Declaro ter recebido de ${dados.empresa.nome}` +
    (enderecoStr ? `, ${enderecoStr},` : ",") +
    ` a quantia de ${fmt(dados.totais.liquido)}` +
    ` (${valorPorExtenso(dados.totais.liquido)}),` +
    ` referente ao gozo de férias do período aquisitivo ${ferias.periodoAquisitivo},` +
    ` com gozo em ${ferias.gozo}, dando plena quitação.`;

  const qLines = doc.splitTextToSize(quitacaoText, contentW - 6);
  doc.text(qLines, MARGIN + 3, y + 6);
  y += 26;

  const hoje = new Date().toLocaleDateString("pt-BR");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Data: ${hoje}`, MARGIN, y);
  y += 10;

  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.25);
  doc.line(MARGIN + 5, y, MARGIN + 90, y);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`${dados.funcionario.nome}`, MARGIN + 5, y + 3.5);
  doc.text("Assinatura do Empregado", MARGIN + 5, y + 7);

  doc.setFontSize(6.5);
  const pageH = doc.internal.pageSize.getHeight();
  doc.text(
    `Emitido em ${hoje} · ${dados.empresa.nome}`,
    pageW / 2,
    pageH - 6,
    { align: "center" },
  );

  return doc.output("arraybuffer");
}

export { formatDate };
