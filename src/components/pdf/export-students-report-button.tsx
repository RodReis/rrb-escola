"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";

type StudentReportRow = {
  matricula: string;
  nome: string;
  cpf: string | null;
  dataNascimento: string | null;
  celular: string | null;
  responsavel: string;
  serie: string;
  turma: string;
  anoLetivo: number | null;
  ativo: boolean;
};

export function ExportStudentsReportButton({ rows }: { rows: StudentReportRow[] }) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Relatorio Geral de Alunos", 148, 12, { align: "center" });

    autoTable(doc, {
      startY: 18,
      theme: "grid",
      head: [["Matricula", "Aluno", "CPF", "Nascimento", "Celular", "Responsavel", "Serie", "Turma", "Ano", "Status"]],
      body: rows.map((row) => [
        row.matricula,
        row.nome,
        row.cpf ?? "",
        row.dataNascimento ?? "",
        row.celular ?? "",
        row.responsavel,
        row.serie,
        row.turma,
        row.anoLetivo ? String(row.anoLetivo) : "",
        row.ativo ? "Ativo" : "Inativo"
      ]),
      styles: { fontSize: 7, cellPadding: 1.6 },
      headStyles: { fillColor: [23, 32, 27] },
      columnStyles: {
        1: { cellWidth: 52 },
        5: { cellWidth: 45 }
      }
    });

    doc.save("relatorio-alunos.pdf");
  }

  return (
    <button onClick={exportPdf} className="ds-button ds-button-secondary">
      <Download size={16} />
      Exportar
    </button>
  );
}
