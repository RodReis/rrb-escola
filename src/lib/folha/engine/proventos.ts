function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcHoraAula(valorHoraAula: number, aulasSemanais: number, semanasMes: number): number {
  return round2(valorHoraAula * aulasSemanais * semanasMes);
}

export function calcDsrSobre(valorSemDsr: number, divisorDsr: number): number {
  if (valorSemDsr <= 0 || divisorDsr <= 1) return 0;
  return round2(valorSemDsr / (divisorDsr - 1));
}

export function calcHoraAtividade(baseComDsr: number, percentual: number): number {
  return round2(baseComDsr * (percentual / 100));
}
