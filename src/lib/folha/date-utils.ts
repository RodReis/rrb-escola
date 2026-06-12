const FERIADOS_NACIONAIS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

export function isDiaUtil(dataISO: string, feriadosLocais: string[]): boolean {
  const d = new Date(`${dataISO}T12:00:00Z`);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  if (FERIADOS_NACIONAIS_FIXOS.includes(dataISO.slice(5))) return false;
  return !feriadosLocais.includes(dataISO);
}

export function nthDiaUtil(competencia: string, n: number, feriadosLocais: string[]): string {
  const [ano, mes] = competencia.split("-").map(Number);
  let count = 0;
  for (let dia = 1; dia <= 31; dia++) {
    const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const d = new Date(`${iso}T12:00:00Z`);
    if (d.getUTCMonth() + 1 !== mes) break;
    if (isDiaUtil(iso, feriadosLocais)) {
      count++;
      if (count === n) return iso;
    }
  }
  throw new Error(`Sem ${n}º dia útil em ${competencia}`);
}
