// Formatação central de datas em pt-BR.
//
// Use `formatDateBR` para qualquer data exibida ao usuário (telas, PDFs, docs).
// Use `formatDateTimeBR` quando precisar de hora também.
// Use `toISODate` apenas para preencher inputs HTML `type="date"`.

const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Formata qualquer data (Date, ISO yyyy-mm-dd, ISO datetime) em dd/MM/yyyy.
 * Retorna "" se valor for nulo/inválido.
 */
export function formatDateBR(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const d = String(value.getDate()).padStart(2, "0");
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${value.getFullYear()}`;
  }
  // Match ISO yyyy-mm-dd no início (date ou datetime)
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return String(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Formata data + hora em dd/MM/yyyy HH:mm.
 * Aceita Date ou ISO datetime.
 */
export function formatDateTimeBR(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

/**
 * Formata data por extenso: "12 de março de 2026".
 */
export function formatDateExtensoBR(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return String(value);
    d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  }
  if (Number.isNaN(d.getTime())) return "";
  const dd = d.getUTCDate();
  const mm = MESES_EXTENSO[d.getUTCMonth()];
  const yy = d.getUTCFullYear();
  return `${dd} de ${mm} de ${yy}`;
}

/**
 * Retorna apenas a parte yyyy-MM-dd de uma data (para inputs HTML type=date).
 */
export function toISODate(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}
