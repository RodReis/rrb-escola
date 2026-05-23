"use client";

import { FileSpreadsheet } from "lucide-react";
import ExcelJS from "exceljs";
import { MOTIVO_LABEL, type AlunoSemValorRow } from "@/lib/data/alunos-sem-valor-constants";

export function ExportAlunosSemValorButton({ rows }: { rows: AlunoSemValorRow[] }) {
  const handleXlsx = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Alunos sem valor");
    ws.columns = [
      { header: "Aluno", key: "aluno", width: 32 },
      { header: "Série", key: "serie", width: 16 },
      { header: "Turma", key: "turma", width: 10 },
      { header: "Motivo", key: "motivo", width: 16 },
      { header: "Valor matrícula", key: "valor", width: 16 },
      { header: "Responsável", key: "responsavel", width: 28 },
      { header: "Parentesco", key: "parentesco", width: 14 },
      { header: "Telefone", key: "telefone", width: 18 },
    ];

    for (const r of rows) {
      const base = {
        aluno: r.nome,
        serie: r.serie,
        turma: r.turma,
        motivo: MOTIVO_LABEL[r.motivo],
        valor: r.valorMatricula,
      };
      if (r.responsaveis.length === 0) {
        ws.addRow({ ...base, responsavel: "", parentesco: "", telefone: "" });
      } else {
        for (const resp of r.responsaveis) {
          ws.addRow({
            ...base,
            responsavel: resp.nome,
            parentesco: resp.parentesco ?? "",
            telefone: resp.telefone,
          });
        }
      }
    }

    ws.getRow(1).font = { bold: true };
    ws.getColumn("valor").numFmt = '"R$ "#,##0.00';

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alunos_sem_valor_2026.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={handleXlsx} className="ds-button ds-button-secondary">
      <FileSpreadsheet size={14} /> Exportar XLSX
    </button>
  );
}
