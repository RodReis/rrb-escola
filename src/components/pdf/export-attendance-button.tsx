"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";

type AttendanceSummary = {
  matricula: string;
  aluno: string;
  presencas: number;
  faltas: number;
  total: number;
  percentual: number;
};

export function ExportAttendanceButton({
  rows,
  start,
  end
}: {
  rows: AttendanceSummary[];
  start: string;
  end: string;
}) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Relatório de Frequência", 148, 12, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Período: ${start} a ${end}`, 148, 17, { align: "center" });

    autoTable(doc, {
      startY: 23,
      theme: "grid",
      head: [["Matrícula", "Aluno", "Presenças", "Faltas", "Total", "% Presença"]],
      body: rows.map((row) => [
        row.matricula,
        row.aluno,
        String(row.presencas),
        String(row.faltas),
        String(row.total),
        `${row.percentual}%`
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [82, 107, 78] }
    });

    doc.save("relatorio-frequencia.pdf");
  }

  return (
    <button onClick={exportPdf} className="ds-button ds-button-secondary">
      <Download size={16} />
      Exportar
    </button>
  );
}
