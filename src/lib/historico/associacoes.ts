export type Range = { anoInicio: number; anoFim: number };

export function rangesSobrepostos(a: Range, b: Range): boolean {
  return a.anoInicio <= b.anoFim && b.anoInicio <= a.anoFim;
}

export function validarNovaAssociacao(
  nova: Range,
  existentes: Range[]
): { ok: true } | { ok: false; conflito: Range } {
  const conflito = existentes.find((e) => rangesSobrepostos(nova, e));
  return conflito ? { ok: false, conflito } : { ok: true };
}
