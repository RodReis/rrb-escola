function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function avos(admissaoISO: string, desligamentoISO: string | null, anoRef: number): number {
  const adm = new Date(`${admissaoISO}T12:00:00Z`);
  const desl = desligamentoISO ? new Date(`${desligamentoISO}T12:00:00Z`) : null;
  let total = 0;
  for (let mes = 0; mes < 12; mes++) {
    const inicioMes = new Date(Date.UTC(anoRef, mes, 1, 12));
    const fimMes = new Date(Date.UTC(anoRef, mes + 1, 0, 12));
    const ini = adm > inicioMes ? adm : inicioMes;
    const fim = desl && desl < fimMes ? desl : fimMes;
    if (ini > fim) continue;
    const dias = Math.floor((fim.getTime() - ini.getTime()) / 86400000) + 1;
    if (dias >= 15) total++;
  }
  return total;
}

export function mediaBase12(basesAnteriores: number[]): number | null {
  if (basesAnteriores.length === 0) return null;
  const ultimas = basesAnteriores.slice(-12);
  return round2(ultimas.reduce((a, b) => a + b, 0) / ultimas.length);
}

export function baseCalculo13Ferias(
  perfilCodigo: string,
  config: Record<string, string>,
  salarioVigente: number,
  basesAnteriores: number[],
): number {
  if (config[perfilCodigo] === "media_12") {
    return mediaBase12(basesAnteriores) ?? round2(salarioVigente);
  }
  return round2(salarioVigente);
}
