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

type Filters = { de: string; ate: string; statuses: string[]; aluno: string | null };

type Props = {
  rows: DelinquencyRow[];
  filters?: Filters;
};

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function ExportDelinquencyButton({ rows, filters }: Props) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Relatório de Inadimplência", 148, 12, { align: "center" });

    let startY = 18;
    if (filters) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Período: ${dateText(filters.de)} a ${dateText(filters.ate)}`, 12, 20);
      doc.text(`Status: ${filters.statuses.join(", ") || "-"}`, 12, 25);
      doc.text(`Aluno: ${filters.aluno || "Todos"}`, 12, 30);
      startY = 35;
    }

    autoTable(doc, {
      startY,
      theme: "grid",
      head: [["Matrícula", "Aluno", "Descrição", "Competência", "Vencimento", "Status", "Valor"]],
      body: rows.map((row) => {
        const aluno = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
        return [
          aluno?.matricula_codigo ?? "",
          aluno?.nome ?? "",
          row.descricao,
          row.competencia,
          dateText(row.data_vencimento),
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
