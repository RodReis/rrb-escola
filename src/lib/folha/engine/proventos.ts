function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcHoraAula(valorHoraAula: number, aulasSemanais: number, semanasMes: number): number {
  return round2(valorHoraAula * aulasSemanais * semanasMes);
}

export function calcDsrSobre(valorVerba: number, divisorDsr: number): number {
  if (valorVerba <= 0 || divisorDsr <= 0) return 0;
  return round2(valorVerba / divisorDsr);
}

export function calcHoraAtividade(baseComDsr: number, percentual: number): number {
  return round2(baseComDsr * (percentual / 100));
}
