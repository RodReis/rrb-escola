"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText } from "lucide-react";
import { displayStatus } from "@/lib/finance/charge-status";

type Pagamento = {
  id: string;
  valor_pago: number | string;
  data_pagamento: string;
  forma_pagamento: string;
  cancelado_em: string | null;
  perfis: { nome: string } | { nome: string }[] | null;
};

type Charge = {
  id: string;
  descricao: string;
  competencia: string;
  numero_parcela: number | null;
  valor_final: number | string;
  data_vencimento: string;
  status: string;
  pagamentos: Pagamento[];
};

type Props = {
  aluno: { nome: string; matricula_codigo: string };
  de: string;
  ate: string;
  charges: Charge[];
};

function fmt(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function ExportStudentStatementButton({ aluno, de, ate, charges }: Props) {
  function exportPdf() {
    const today = new Date().toISOString().slice(0, 10);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("RRB Escola — Extrato Financeiro", 105, 14, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Aluno: ${aluno.nome} (matricula ${aluno.matricula_codigo})`, 12, 22);
    doc.text(`Periodo: ${dateText(de)} a ${dateText(ate)}`, 12, 27);

    const chargeRows = charges.map((c) => {
      const pago = c.pagamentos.filter((p) => !p.cancelado_em).reduce((sum, p) => sum + Number(p.valor_pago), 0);
      const saldo = Math.max(Number(c.valor_final) - pago, 0);
      return [
        dateText(c.data_vencimento),
        c.descricao,
        fmt(c.valor_final),
        fmt(pago),
        fmt(saldo),
        displayStatus(c.status, c.data_vencimento, today)
      ];
    });

    autoTable(doc, {
      startY: 33,
      theme: "grid",
      head: [["Vencimento", "Descricao", "Valor", "Pago", "Saldo", "Status"]],
      body: chargeRows,
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [23, 32, 27] }
    });

    const totalCobrado = charges.reduce((s, c) => s + Number(c.valor_final), 0);
    const totalPagoVal = charges.reduce((s, c) => s + c.pagamentos.filter((p) => !p.cancelado_em).reduce((sum, p) => sum + Number(p.valor_pago), 0), 0);
    const saldoDevedor = Math.max(totalCobrado - totalPagoVal, 0);

    // @ts-expect-error autoTable adds lastAutoTable
    const finalY = doc.lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Total cobrado: ${fmt(totalCobrado)}`, 12, finalY);
    doc.text(`Total pago:    ${fmt(totalPagoVal)}`, 12, finalY + 5);
    doc.text(`Saldo devedor: ${fmt(saldoDevedor)}`, 12, finalY + 10);

    const paymentsBody = charges.flatMap((c) =>
      c.pagamentos.filter((p) => !p.cancelado_em).map((p) => {
        const perfil = Array.isArray(p.perfis) ? p.perfis[0] : p.perfis;
        return [
          dateText(p.data_pagamento),
          c.descricao,
          fmt(p.valor_pago),
          p.forma_pagamento,
          perfil?.nome ?? "-"
        ];
      })
    );

    autoTable(doc, {
      startY: finalY + 16,
      theme: "grid",
      head: [["Data", "Cobranca", "Valor", "Forma", "Recebido por"]],
      body: paymentsBody.length > 0 ? paymentsBody : [["—", "Sem pagamentos no periodo", "", "", ""]],
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [23, 32, 27] }
    });

    doc.save(`extrato-${aluno.matricula_codigo}-${de}_${ate}.pdf`);
  }

  return (
    <button onClick={exportPdf} className="ds-button ds-button-secondary" type="button">
      <FileText size={16} /> Exportar extrato
    </button>
  );
}
