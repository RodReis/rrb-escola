"use client";

import { FileSpreadsheet } from "lucide-react";
import { ORIGEM_LABEL, type AlunoComDescontoRow } from "@/lib/data/alunos-com-desconto-constants";

export function ExportAlunosComDescontoButton({ rows }: { rows: AlunoComDescontoRow[] }) {
  const handleXlsx = async () => {
    // Lazy-load exceljs (~200 kB) only when the user clicks export.
    // exceljs is a CJS module without a default export — use the namespace directly.
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Alunos com desconto");
    ws.columns = [
      { header: "Aluno", key: "aluno", width: 32 },
      { header: "Série", key: "serie", width: 12 },
      { header: "Turma", key: "turma", width: 10 },
      { header: "Segmento", key: "segmento", width: 14 },
      { header: "Origem do desconto", key: "origem", width: 22 },
      { header: "Valor praticado (cheio)", key: "valorCheio", width: 18 },
      { header: "Valor mensalidade plano", key: "valorPlano", width: 20 },
      { header: "% bolsa parcial", key: "pctBolsa", width: 14 },
      { header: "% desconto efetivo", key: "pctEf", width: 18 },
      { header: "Responsável", key: "responsavel", width: 28 },
      { header: "Parentesco", key: "parentesco", width: 14 },
      { header: "Telefone", key: "telefone", width: 18 },
    ];

    for (const r of rows) {
      ws.addRow({
        aluno: r.nome,
        serie: r.serie,
        turma: r.turma,
        segmento: r.segmento,
        origem: ORIGEM_LABEL[r.origem],
        valorCheio: r.valorPraticadoCheio,
        valorPlano: r.valorMensalidadePlano,
        pctBolsa: r.percentualBolsaParcial / 100,
        pctEf: r.percentualDescontoEfetivo,
        responsavel: r.responsavelNome ?? "",
        parentesco: r.responsavelParentesco ?? "",
        telefone: r.responsavelTelefone ?? "",
      });
    }

    ws.getRow(1).font = { bold: true };
    ws.getColumn("valorCheio").numFmt = '"R$ "#,##0.00';
    ws.getColumn("valorPlano").numFmt = '"R$ "#,##0.00';
    ws.getColumn("pctBolsa").numFmt = "0.0%";
    ws.getColumn("pctEf").numFmt = "0.0%";

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alunos_com_desconto_2026.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={handleXlsx} className="ds-button ds-button-secondary">
      <FileSpreadsheet size={14} /> Exportar XLSX
    </button>
  );
}
