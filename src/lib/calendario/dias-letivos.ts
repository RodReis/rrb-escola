import type { Calendario, CalendarioExcecao } from "./types";

// Datas em formato YYYY-MM-DD são comparáveis lexicograficamente.
// Para o dia-da-semana, parse explícito em UTC evita drift de timezone.
function diaDaSemana(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function dentroDoIntervalo(date: string, inicio: string, fim: string): boolean {
  return date >= inicio && date <= fim;
}

export function isDiaLetivo(
  date: string,
  calendario: Calendario,
  excecoes: CalendarioExcecao[],
): boolean {
  if (!dentroDoIntervalo(date, calendario.dataInicio, calendario.dataFim)) {
    return false;
  }
  if (!calendario.diasSemanaLetivos.includes(diaDaSemana(date))) {
    return false;
  }
  for (const ex of excecoes) {
    if (dentroDoIntervalo(date, ex.dataInicio, ex.dataFim)) {
      return false;
    }
  }
  return true;
}
