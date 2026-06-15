"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  titulo: string;
  colunas: string[];
  linhas: (string | number)[][];
  nomeArquivo: string;
};

// Botão genérico de export (PDF + XLSX) para os relatórios comerciais.
export function ExportRelatorioButton({ titulo, colunas, linhas, nomeArquivo }: Props) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(titulo, 148, 12, { align: "center" });
    autoTable(doc, {
      startY: 18,
      theme: "grid",
      head: [colunas],
      body: linhas.map((l) => l.map((c) => String(c))),
      styles: { fontSize: 8 }
    });
    doc.save(`${nomeArquivo}.pdf`);
  }

  async function exportXlsx() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(titulo.slice(0, 30));
    ws.addRow(colunas);
    ws.getRow(1).font = { bold: true };
    linhas.forEach((l) => ws.addRow(l));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeArquivo}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" onClick={exportPdf} disabled={linhas.length === 0}>
        <FileDown size={14} /> PDF
      </Button>
      <Button type="button" variant="secondary" onClick={exportXlsx} disabled={linhas.length === 0}>
        <FileSpreadsheet size={14} /> Excel
      </Button>
    </div>
  );
}
