// Mês de referência sempre representado como YYYY-MM-01 (primeiro dia)
// no banco. Na URL usamos YYYY-MM. Helpers para conversão e navegação.

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const MESES_PT_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function urlToDbMonth(urlMonth: string): string {
  return `${urlMonth}-01`;
}

export function dbToUrlMonth(dbMonth: string): string {
  return dbMonth.slice(0, 7);
}

export function currentUrlMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function isValidUrlMonth(urlMonth: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(urlMonth);
}

export function shiftUrlMonth(urlMonth: string, deltaMonths: number): string {
  const [y, m] = urlMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m - 1) + deltaMonths, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function monthLabel(urlMonth: string): string {
  const [y, m] = urlMonth.split("-").map(Number);
  return `${MESES_PT[m - 1]} ${y}`;
}

export function monthLabelShort(urlMonth: string): string {
  const [y, m] = urlMonth.split("-").map(Number);
  return `${MESES_PT_ABBR[m - 1]}/${y}`;
}
