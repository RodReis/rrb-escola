const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function txt(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** "2015-03-10" (ou timestamp ISO) → "10/03/2015", sem passar por Date (evita fuso). */
export function fmtData(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function fmtMoeda(v: number | null): string {
  return v === null || v === undefined || Number.isNaN(v) ? "" : MOEDA.format(v);
}

export function idade(iso: string | null, hoje: Date): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return "";
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let anos = hoje.getFullYear() - ano;
  const mesHoje = hoje.getMonth() + 1;
  if (mesHoje < mes || (mesHoje === mes && hoje.getDate() < dia)) anos -= 1;
  return anos >= 0 ? String(anos) : "";
}

export function juntar(vals: Array<string | null | undefined>): string {
  return vals.map((v) => txt(v)).filter(Boolean).join(" / ");
}

export function normalizarTexto(s: string | null): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function primeiroNome(nome: string): string {
  return txt(nome).split(/\s+/)[0]?.toUpperCase() ?? "";
}
