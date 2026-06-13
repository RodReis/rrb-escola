// Cálculo de faixas INSS/IRRF — infraestrutura compartilhada pelo motor da folha v2
// e pela camada de brackets. Independente de qualquer folha específica.

export type InssBracket = {
  ordem: number;
  valor_de: number;
  valor_ate: number | null;
  aliquota: number;
  parcela_deduzir: number;
};

export type IrBracket = {
  ordem: number;
  valor_de: number;
  valor_ate: number | null;
  aliquota: number;
  parcela_deduzir: number;
  deducao_dependente: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcINSS(base: number, brackets: InssBracket[]): number {
  if (base <= 0 || brackets.length === 0) return 0;
  const sorted = [...brackets].sort((a, b) => a.ordem - b.ordem);

  const teto = sorted.reduce((max, b) => (b.valor_ate ?? max) > max ? (b.valor_ate ?? max) : max, 0);
  const baseLimitada = Math.min(base, teto);

  let total = 0;
  for (const b of sorted) {
    const ate = b.valor_ate ?? Infinity;
    const faixaSize = Math.max(0, Math.min(baseLimitada, ate) - b.valor_de);
    if (faixaSize <= 0) continue;
    total += faixaSize * b.aliquota;
    if (baseLimitada <= ate) break;
  }
  return round2(total);
}

export function calcIR(baseAfterInss: number, dependentes: number, brackets: IrBracket[]): number {
  if (baseAfterInss <= 0 || brackets.length === 0) return 0;
  const sorted = [...brackets].sort((a, b) => a.ordem - b.ordem);
  const deducaoDep = (sorted[0]?.deducao_dependente ?? 0) * Math.max(0, dependentes);
  const baseFinal = Math.max(0, baseAfterInss - deducaoDep);

  for (const b of sorted) {
    const ate = b.valor_ate ?? Infinity;
    if (baseFinal <= ate) {
      return round2(Math.max(0, baseFinal * b.aliquota - b.parcela_deduzir));
    }
  }
  const last = sorted[sorted.length - 1]!;
  return round2(Math.max(0, baseFinal * last.aliquota - last.parcela_deduzir));
}
