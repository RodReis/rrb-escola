"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText } from "lucide-react";
import type { BoletimData } from "@/lib/data/pedagogico";

function fmt(n: number | null): string {
  return n === null ? "—" : n.toFixed(1);
}

export function ExportBoletimButton({ boletim }: { boletim: BoletimData }) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Boletim Escolar", 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Ano letivo ${boletim.matricula.anoLetivo}`, 105, 22, { align: "center" });

    // Dados do aluno
    autoTable(doc, {
      startY: 28,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: 0, lineWidth: 0.2, textColor: 0 },
      headStyles: { fillColor: [232, 232, 232], textColor: 0, halign: "center", fontStyle: "bold" },
      head: [["Dados do aluno"]],
      body: [
        [`Nome: ${boletim.aluno.nome}`],
        [`Matrícula: ${boletim.aluno.matriculaCodigo ?? "—"}`],
        [`Série / Turma: ${boletim.matricula.serie} ${boletim.matricula.turma}`],
      ],
    });

    // Notas
    const bodyNotas = boletim.disciplinas.map((d) => {
      const situacao = d.mediaAnual === null ? "—" : d.mediaAnual >= 6 ? "Aprovado" : "Reprovado";
      return [
        d.disciplina,
        fmt(d.bimestres[0]?.media ?? null),
        fmt(d.bimestres[1]?.media ?? null),
        fmt(d.bimestres[2]?.media ?? null),
        fmt(d.bimestres[3]?.media ?? null),
        d.mediaAnual !== null ? d.mediaAnual.toFixed(2) : "—",
        situacao,
      ];
    });

    autoTable(doc, {
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: 0, lineWidth: 0.2, textColor: 0, halign: "center" },
      headStyles: { fillColor: [232, 232, 232], textColor: 0, halign: "center", fontStyle: "bold" },
      columnStyles: { 0: { halign: "left" }, 6: { halign: "center" } },
      head: [["Disciplina", "1º Bim", "2º Bim", "3º Bim", "4º Bim", "Anual", "Situação"]],
      body: bodyNotas.length > 0 ? bodyNotas : [[{ content: "Nenhuma nota lançada", colSpan: 7, styles: { halign: "center" } }]],
    });

    // Frequência
    const f = boletim.frequencia;
    autoTable(doc, {
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: 0, lineWidth: 0.2, textColor: 0 },
      headStyles: { fillColor: [232, 232, 232], textColor: 0, halign: "center", fontStyle: "bold" },
      head: [["Frequência", "Valor"]],
      body: [
        ["Total de dias com registro", String(f.totalDias)],
        ["Presenças", String(f.presencas)],
        ["Faltas", String(f.faltas)],
        ["Taxa de presença", `${(f.taxa * 100).toFixed(1)}%`],
      ],
    });

    // Rodapé
    const dataEmissao = new Date().toLocaleDateString("pt-BR");
    doc.setFontSize(8);
    doc.text(`Emitido em ${dataEmissao}`, 200, 290, { align: "right" });

    const nomeArquivo = `boletim_${boletim.aluno.nome.replace(/\s+/g, "_")}_${boletim.matricula.anoLetivo}.pdf`;
    doc.save(nomeArquivo);
  }

  return (
    <button
      type="button"
      onClick={exportPdf}
      className="ds-button ds-button-primary"
    >
      <FileText size={14} /> Exportar PDF
    </button>
  );
}
