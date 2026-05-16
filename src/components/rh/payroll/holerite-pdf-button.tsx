"use client";

import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { monthLabel } from "@/lib/payroll/date-utils";
import { money } from "@/lib/constants";
import type { PayrollRowJoined } from "@/lib/data/payroll";

export function HoleritePdfButton({ row, mes }: { row: PayrollRowJoined; mes: string }) {
  const handleClick = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const emp = row.employees;
    const comp = emp?.companies;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(comp?.name ?? "—", 14, 16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`CNPJ: ${comp?.cnpj ?? "—"}`, 14, 22);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE PAGAMENTO DE SALÁRIO", 105, 22, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Competência: ${monthLabel(mes)}`, 196, 22, { align: "right" });

    doc.line(14, 26, 196, 26);

    doc.setFontSize(9);
    doc.text(`Nome: ${emp?.name ?? "—"}`, 14, 33);
    doc.text(`CPF: ${emp?.cpf ?? "—"}`, 110, 33);
    doc.text(`Cargo: ${emp?.cargo ?? "—"}`, 14, 39);
    doc.text(`Categoria: ${emp?.school_category ?? "—"}`, 110, 39);

    const proventos: Array<[string, string, string]> = [];
    const descontos: Array<[string, string, string]> = [];
    const push = (arr: typeof proventos, code: string, label: string, val: number | null) => {
      const v = Number(val ?? 0);
      if (v > 0) arr.push([code, label, money.format(v)]);
    };
    push(proventos, "001", "Salário base", row.base_salary);
    push(proventos, "002", "Horas extras", row.horas_extras);
    push(proventos, "003", "Gratificação", row.gratificacao);
    push(proventos, "004", "Comissão", row.comissao);
    push(proventos, "005", "Adicional noturno", row.adicional_noturno);
    push(proventos, "006", "Periculosidade", row.periculosidade);
    push(proventos, "007", "Insalubridade", row.insalubridade);
    push(proventos, "008", "Outros proventos", row.outros_proventos);
    push(proventos, "009", "Salário-família", row.family_allowance);

    push(descontos, "101", "INSS", row.inss);
    push(descontos, "102", "IRRF", row.ir);
    push(descontos, "103", "Empréstimo", row.loan_deduction);
    push(descontos, "104", "Adiantamento", row.advance);
    push(descontos, "105", "Vale transporte", row.vale_transporte);
    push(descontos, "106", "Vale alimentação", row.vale_alimentacao);
    push(descontos, "107", "Uniforme", row.uniform_value);
    push(descontos, "108", "Outros descontos", row.outros_descontos);

    autoTable(doc, {
      startY: 45,
      head: [["Cód.", "Proventos", "Valor"]],
      body: proventos.length ? proventos : [["", "Nenhum provento", ""]],
      styles: { fontSize: 9, halign: "left" },
      columnStyles: { 2: { halign: "right" } },
      headStyles: { fillColor: [27, 79, 216] },
      theme: "grid"
    });

    const yAfterProv = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    autoTable(doc, {
      startY: yAfterProv,
      head: [["Cód.", "Descontos", "Valor"]],
      body: descontos.length ? descontos : [["", "Nenhum desconto", ""]],
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: "right" } },
      headStyles: { fillColor: [190, 50, 50] },
      theme: "grid"
    });

    const yAfterDesc = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Total proventos: ${money.format(Number(row.total_earnings ?? 0))}`, 14, yAfterDesc);
    doc.text(`Total descontos: ${money.format(Number(row.total_deductions ?? 0))}`, 14, yAfterDesc + 6);
    doc.setFontSize(12);
    doc.text(`Líquido a receber: ${money.format(Number(row.net_amount ?? 0))}`, 14, yAfterDesc + 14);

    // Bases informativas
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const baseInss = Number(row.total_earnings ?? 0) - Number(row.family_allowance ?? 0);
    const baseIr = baseInss - Number(row.inss ?? 0);
    const fgts = Math.round(baseInss * 0.08 * 100) / 100;
    doc.text(`Base INSS: ${money.format(baseInss)}  |  Base IR: ${money.format(baseIr)}  |  FGTS (8%): ${money.format(fgts)}`, 14, yAfterDesc + 22);

    doc.line(20, yAfterDesc + 38, 90, yAfterDesc + 38);
    doc.text("Assinatura do funcionário", 30, yAfterDesc + 42);
    doc.line(120, yAfterDesc + 38, 190, yAfterDesc + 38);
    doc.text("Assinatura da empresa", 132, yAfterDesc + 42);

    const cpfClean = (emp?.cpf ?? "").replace(/\D/g, "");
    doc.save(`holerite_${cpfClean}_${mes}.pdf`);
  };

  return (
    <button type="button" onClick={handleClick} className="ds-button ds-button-secondary">
      <FileDown size={14} /> Holerite PDF
    </button>
  );
}
