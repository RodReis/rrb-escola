"use client";

import jsPDF from "jspdf";
import { Receipt } from "lucide-react";

type Props = {
  pagamento: {
    id: string;
    valor_pago: number | string;
    data_pagamento: string;
    forma_pagamento: string;
    observacao?: string | null;
    perfis: { nome: string } | null;
  };
  cobranca: {
    id: string;
    descricao: string;
    competencia: string;
    numero_parcela: number | null;
    valor_final: number | string;
    valor_original: number | string;
    valor_desconto: number | string;
    valor_acrescimo: number | string;
  };
  aluno: { nome: string; matricula_codigo: string };
  saldoApos: number;
};

function fmt(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function ExportPaymentReceiptButton({ pagamento, cobranca, aluno, saldoApos }: Props) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
    let y = 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("RRB Escola", 12, y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("CNPJ 00.000.000/0001-00 | (62) 3333-0000", 12, y + 5);
    doc.text(`Recibo Nº: ${pagamento.id.slice(0, 8).toUpperCase()}`, 12, y + 10);

    y += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RECIBO DE PAGAMENTO", 12, y);
    doc.setLineWidth(0.2);
    doc.line(12, y + 2, 136, y + 2);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Aluno: ${aluno.nome} (matrícula ${aluno.matricula_codigo})`, 12, y);
    y += 5;
    doc.text(`Referente a: ${cobranca.descricao}`, 12, y);
    y += 5;
    doc.text(`Competência: ${cobranca.competencia}    Parcela: ${cobranca.numero_parcela ?? "-"}`, 12, y);

    y += 8;
    doc.text(`Valor original:   ${fmt(cobranca.valor_original)}`, 12, y); y += 5;
    doc.text(`Desconto:        -${fmt(cobranca.valor_desconto)}`, 12, y); y += 5;
    doc.text(`Acréscimo:       +${fmt(cobranca.valor_acrescimo)}`, 12, y); y += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Valor cobrança:   ${fmt(cobranca.valor_final)}`, 12, y); y += 7;
    doc.line(12, y - 2, 70, y - 2);
    doc.setFont("helvetica", "normal");
    doc.text(`Valor pago:       ${fmt(pagamento.valor_pago)}`, 12, y); y += 5;
    doc.text(`Forma:            ${pagamento.forma_pagamento}`, 12, y); y += 5;
    doc.text(`Data:             ${dateText(pagamento.data_pagamento)}`, 12, y); y += 5;
    if (saldoApos > 0) {
      doc.text(`Saldo após pagamento: ${fmt(saldoApos)}`, 12, y);
      y += 5;
    }

    y += 5;
    doc.text(`Recebido por: ${pagamento.perfis?.nome ?? "-"}`, 12, y);
    y += 5;
    doc.text(`Local e data: Goiânia, ${new Date().toLocaleDateString("pt-BR")}`, 12, y);

    y += 18;
    doc.line(12, y, 90, y);
    doc.text("Assinatura", 12, y + 5);

    doc.save(`recibo-${pagamento.id.slice(0, 8)}.pdf`);
  }

  return (
    <button onClick={exportPdf} className="ds-button ds-button-ghost min-h-0 px-2 py-1 text-xs" type="button">
      <Receipt size={14} /> Recibo
    </button>
  );
}
