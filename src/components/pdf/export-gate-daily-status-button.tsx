"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";

type GateDailyStatusRow = {
  matricula_codigo: string;
  nome: string;
  status: string;
  primeira_entrada: string | null;
  ultima_saida: string | null;
  ultimo_evento: string | null;
  origem: string | null;
  total_eventos: number;
};

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "-";
}

function labelStatus(status: string) {
  if (status === "dentro") return "Dentro";
  if (status === "saiu") return "Saiu";
  return "Nao chegou";
}

export function ExportGateDailyStatusButton({ rows, date }: { rows: GateDailyStatusRow[]; date: string }) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Painel Diario da Portaria", 148, 12, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Data: ${date}`, 148, 17, { align: "center" });

    autoTable(doc, {
      startY: 23,
      theme: "grid",
      head: [["Matricula", "Aluno", "Status", "Primeira entrada", "Ultima saida", "Ultimo evento", "Origem", "Eventos"]],
      body: rows.map((row) => [
        row.matricula_codigo,
        row.nome,
        labelStatus(row.status),
        formatDateTime(row.primeira_entrada),
        formatDateTime(row.ultima_saida),
        formatDateTime(row.ultimo_evento),
        row.origem ?? "-",
        String(row.total_eventos)
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [82, 107, 78] }
    });

    doc.save(`painel-portaria-${date}.pdf`);
  }

  return (
    <button onClick={exportPdf} className="ds-button ds-button-secondary">
      <Download size={16} />
      Exportar PDF
    </button>
  );
}
