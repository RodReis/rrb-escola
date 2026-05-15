"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";

type DelinquencyRow = {
  descricao: string;
  competencia: string;
  data_vencimento: string;
  status: string;
  valor_final: number | string;
  alunos: { matricula_codigo: string; nome: string } | { matricula_codigo: string; nome: string }[] | null;
};

export function ExportDelinquencyButton({ rows }: { rows: DelinquencyRow[] }) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Relatorio de Inadimplencia", 148, 12, { align: "center" });

    autoTable(doc, {
      startY: 18,
      theme: "grid",
      head: [["Matricula", "Aluno", "Descricao", "Competencia", "Vencimento", "Status", "Valor"]],
      body: rows.map((row) => {
        const aluno = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
        return [
          aluno?.matricula_codigo ?? "",
          aluno?.nome ?? "",
          row.descricao,
          row.competencia,
          row.data_vencimento,
          row.status,
          Number(row.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [184, 91, 63] }
    });

    doc.save("relatorio-inadimplencia.pdf");
  }

  return (
    <button onClick={exportPdf} className="ds-button ds-button-secondary">
      <Download size={16} />
      Exportar
    </button>
  );
}
