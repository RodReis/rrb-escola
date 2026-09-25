import type { DadosRelatorio } from "../tipos";

function escapar(v: string): string {
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV para Excel PT-BR: `;`, BOM UTF-8, CRLF, escape RFC 4180. */
export function gerarCsv(dados: DadosRelatorio): string {
  const linhas = [dados.colunas.map((c) => c.label), ...dados.linhas];
  return "﻿" + linhas.map((l) => l.map(escapar).join(";")).join("\r\n") + "\r\n";
}
