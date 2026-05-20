"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
import { formatDateBR } from "@/lib/dates";

type FinanceRow = {
  descricao: string;
  competencia: string;
  data_vencimento: string;
  status: string;
  valor_final: number | string;
  alunos: { nome: string } | null;
  pagamentos: Array<{
    valor_pago: number | string;
    data_pagamento: string;
    forma_pagamento: string;
  }>;
};

export function ExportFinanceButton({ rows }: { rows: FinanceRow[] }) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Relatório Financeiro Escolar", 148, 12, { align: "center" });

    autoTable(doc, {
      startY: 18,
      theme: "grid",
      head: [["Aluno", "Descrição", "Competência", "Vencimento", "Status", "Valor", "Pagamento"]],
      body: rows.map((row) => [
        row.alunos?.nome ?? "",
        row.descricao,
        row.competencia,
        formatDateBR(row.data_vencimento),
        row.status,
        Number(row.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        row.pagamentos?.[0]
          ? `${formatDateBR(row.pagamentos[0].data_pagamento)} - ${Number(row.pagamentos[0].valor_pago).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
          : ""
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [23, 32, 27] }
    });

    doc.save("relatorio-financeiro.pdf");
  }

  return (
    <button onClick={exportPdf} className="ds-button ds-button-secondary">
      <Download size={16} />
      Exportar
    </button>
  );
}
