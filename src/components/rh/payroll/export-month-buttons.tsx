"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { monthLabel } from "@/lib/payroll/date-utils";
import { money } from "@/lib/constants";
import type { PayrollRowJoined } from "@/lib/data/payroll";

export function ExportMonthButtons({ rows, mes }: { rows: PayrollRowJoined[]; mes: string }) {
  const handleXlsx = async () => {
    // Lazy-load exceljs (~200 kB) only when the user clicks export.
    // exceljs is a CJS module without a default export — use the namespace directly.
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Folha ${mes}`);
    ws.columns = [
      { header: "Funcionário", key: "name", width: 30 },
      { header: "CPF", key: "cpf", width: 16 },
      { header: "Empresa", key: "empresa", width: 25 },
      { header: "Base", key: "base", width: 12 },
      { header: "Proventos", key: "proventos", width: 14 },
      { header: "INSS", key: "inss", width: 12 },
      { header: "IR", key: "ir", width: 12 },
      { header: "Descontos", key: "descontos", width: 14 },
      { header: "Líquido", key: "liquido", width: 14 }
    ];
    rows.forEach((r) => {
      ws.addRow({
        name: r.employees?.name ?? "—",
        cpf: r.employees?.cpf ?? "",
        empresa: r.employees?.companies?.name ?? "—",
        base: Number(r.base_salary ?? 0),
        proventos: Number(r.total_earnings ?? 0),
        inss: Number(r.inss ?? 0),
        ir: Number(r.ir ?? 0),
        descontos: Number(r.total_deductions ?? 0),
        liquido: Number(r.net_amount ?? 0)
      });
    });
    ws.getRow(1).font = { bold: true };
    ["base", "proventos", "inss", "ir", "descontos", "liquido"].forEach((k) => {
      ws.getColumn(k).numFmt = '"R$ "#,##0.00';
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folha_${mes}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdf = async () => {
    // Lazy-load jspdf + autotable only when the user clicks export.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Folha de pagamento — ${monthLabel(mes)}`, 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [["Funcionário", "Empresa", "Base", "Proventos", "INSS", "IR", "Descontos", "Líquido"]],
      body: rows.map((r) => [
        r.employees?.name ?? "—",
        r.employees?.companies?.name ?? "—",
        money.format(Number(r.base_salary ?? 0)),
        money.format(Number(r.total_earnings ?? 0)),
        money.format(Number(r.inss ?? 0)),
        money.format(Number(r.ir ?? 0)),
        money.format(Number(r.total_deductions ?? 0)),
        money.format(Number(r.net_amount ?? 0))
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [27, 79, 216] },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" }
      },
      theme: "striped"
    });

    doc.save(`folha_${mes}.pdf`);
  };

  return (
    <div className="inline-flex gap-2">
      <button type="button" onClick={handleXlsx} className="ds-button ds-button-secondary">
        <FileSpreadsheet size={14} /> Exportar XLSX
      </button>
      <button type="button" onClick={handlePdf} className="ds-button ds-button-secondary">
        <FileText size={14} /> Exportar PDF
      </button>
    </div>
  );
}
