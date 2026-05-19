"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
import type { StudentSheet } from "@/lib/types";
import { formatDateBR } from "@/lib/dates";

function value(text: unknown) {
  return text ? String(text) : "";
}

const DATE_COLS = new Set(["data_nascimento", "data_matricula", "data_aula", "data_vencimento", "data_pagamento"]);
function dval(col: string, v: unknown) {
  if (DATE_COLS.has(col)) return formatDateBR(typeof v === "string" ? v : v instanceof Date ? v : null);
  return value(v);
}

export function exportStudentPdf(student: StudentSheet) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const address = student.enderecos_aluno[0];
  const medical = student.informacoes_medicas;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Ficha do Aluno", 105, 9, { align: "center" });

  autoTable(doc, {
    startY: 12,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1, lineColor: 0, lineWidth: 0.2, textColor: 0 },
    headStyles: { fillColor: [232, 232, 232], textColor: 0, halign: "center" },
    body: [
      [{ content: "Dados do Aluno", colSpan: 4, styles: { halign: "center", fontStyle: "bold", fillColor: [232, 232, 232] } }],
      [`Matricula\n${student.matricula_codigo}`, `Nome\n${student.nome}`, `Sexo\n${value(student.sexo)}`, `Dt. Nascimento\n${dval("data_nascimento", student.data_nascimento)}`],
      [`Naturalidade\n${value(student.naturalidade)}`, `Celular\n${value(student.celular)}`, `CPF\n${value(student.cpf)}`, `RG\n${value(student.rg)}`],
      [{ content: `Endereco\n${value(address?.logradouro)}`, colSpan: 2 }, `Cidade\n${value(address?.cidade)}-${value(address?.uf)}`, `CEP\n${value(address?.cep)}`],
      [`E-Mail\n${value(student.email)}`, `Cod. INEP\n${value(student.codigo_inep)}`, `Etnia\n${value(student.etnia)}`, `Informacoes adicionais\n${value(student.informacoes_adicionais)}`]
    ]
  });

  autoTable(doc, {
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1, lineColor: 0, lineWidth: 0.2, textColor: 0 },
    head: [["Nome", "CPF", "Telefone", "Celular", "Parentesco", "E-Mail"]],
    body: student.responsaveis_aluno.map((item) => [
      item.nome,
      value(item.cpf),
      value(item.telefone),
      value(item.celular),
      value(item.parentesco),
      value(item.email)
    ])
  });

  autoTable(doc, {
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1, lineColor: 0, lineWidth: 0.2, textColor: 0 },
    head: [["Codigo", "Ano", "Serie", "Turma", "Plano", "Status", "Data", "Idade"]],
    body: student.matriculas.map((item) => [
      value(item.codigo),
      value(item.ano_letivo),
      value(item.series?.nome),
      value(item.turmas?.nome),
      value(item.planos?.nome),
      value(item.status),
      dval("data_matricula", item.data_matricula),
      value(item.idade_na_matricula)
    ])
  });

  autoTable(doc, {
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1, lineColor: 0, lineWidth: 0.2, textColor: 0 },
    body: [
      [{ content: "Informacoes Medicas", colSpan: 4, styles: { halign: "center", fontStyle: "bold", fillColor: [232, 232, 232] } }],
      [`Alergia: ${medical?.alergia ? "( X )" : "(  )"}`, `Portador Nec. Especiais: ${medical?.necessidade_especial ? "( X )" : "(  )"}`, `Nec. Apoio/Recurso: ${medical?.necessita_apoio ? "( X )" : "(  )"}`, `Possui Doenca Grave: ${medical?.doenca_grave ? "( X )" : "(  )"}`],
      [`Medico\n${value(medical?.medico)}`, `Telefone\n${value(medical?.telefone_medico)}`, `Plano de Saude\n${value(medical?.plano_saude)}`, `Telefone\n${value(medical?.telefone_plano)}`]
    ]
  });

  doc.save(`ficha-${student.matricula_codigo}.pdf`);
}

export function ExportStudentButton({ student }: { student: StudentSheet }) {
  return (
    <button onClick={() => exportStudentPdf(student)} className="ds-button ds-button-secondary">
      <Download size={16} />
      Exportar PDF
    </button>
  );
}
