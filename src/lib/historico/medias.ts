/** Média anual de uma disciplina: média simples das bimestrais lançadas. */
export function mediaAnual(bimestrais: Array<number | null>): number | null {
  const valores = bimestrais.filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  const soma = valores.reduce((acc, v) => acc + v, 0);
  return Math.round((soma / valores.length) * 10) / 10;
}
