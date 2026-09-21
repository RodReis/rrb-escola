"use client";

import { Download } from "lucide-react";
import type { AniversarioSemanaRow } from "@/lib/data/dashboard-executive";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function anoAniversario(a: AniversarioSemanaRow): number {
  const hoje = new Date();
  const jaPassou =
    a.mes < hoje.getMonth() + 1 || (a.mes === hoje.getMonth() + 1 && a.dia < hoje.getDate());
  return jaPassou ? hoje.getFullYear() + 1 : hoje.getFullYear();
}

function toCsv(items: AniversarioSemanaRow[]): string {
  const header = ["Nome", "Data", "Serie", "Turma"];
  const linhas = items.map((a) => [
    a.nome,
    `${String(a.dia).padStart(2, "0")}/${String(a.mes).padStart(2, "0")}/${anoAniversario(a)}`,
    a.serie ?? "",
    a.turma ?? "",
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [header, ...linhas].map((row) => row.map(escape).join(";")).join("\r\n");
}

function download(filename: string, csv: string) {
  // BOM para acentuação abrir correta no Excel
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportAniversariantesCsvButton({
  items,
  label,
  filenamePrefix,
}: {
  items: AniversarioSemanaRow[];
  label: string;
  filenamePrefix: string;
}) {
  const hoje = new Date();
  const handleClick = () => {
    const filename = `${filenamePrefix}-${MESES[hoje.getMonth()]}-${hoje.getFullYear()}.csv`;
    download(filename, toCsv(items));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={items.length === 0}
      className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Download size={13} /> {label}
    </button>
  );
}
