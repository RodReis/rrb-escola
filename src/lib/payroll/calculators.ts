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

export type PayrollInput = {
  base_salary: number;
  horas_extras: number;
  gratificacao: number;
  comissao: number;
  adicional_noturno: number;
  periculosidade: number;
  insalubridade: number;
  outros_proventos: number;
  family_allowance: number;
  vale_transporte: number;
  vale_alimentacao: number;
  outros_descontos: number;
  loan_deduction: number;
  advance: number;
  uniform_value: number;
  dependentes: number;
  salario_sem_dsr?: number;
  aplica_dobra?: boolean;
};

export type ComputedPayroll = {
  total_earnings: number;
  inss: number;
  ir: number;
  total_deductions: number;
  net_amount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcDSR(salarioSemDsr: number): number {
  if (salarioSemDsr <= 0) return 0;
  return round2(salarioSemDsr / 5);
}

export function calcBaseFromSemDsr(salarioSemDsr: number): number {
  if (salarioSemDsr <= 0) return 0;
  return round2(salarioSemDsr + calcDSR(salarioSemDsr));
}

export function calcProventosBase(salarioSemDsr: number, aplicaDobra: boolean): number {
  const base = calcBaseFromSemDsr(salarioSemDsr);
  return aplicaDobra ? round2(base * 2) : base;
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

export function calcTotalEarnings(input: PayrollInput): number {
  return round2(
    input.base_salary +
    input.horas_extras +
    input.gratificacao +
    input.comissao +
    input.adicional_noturno +
    input.periculosidade +
    input.insalubridade +
    input.outros_proventos +
    input.family_allowance
  );
}

export function calcTotalDeductions(input: PayrollInput, inss: number, ir: number): number {
  return round2(
    inss +
    ir +
    input.loan_deduction +
    input.advance +
    input.vale_transporte +
    input.vale_alimentacao +
    input.outros_descontos +
    input.uniform_value
  );
}

export function calcAll(
  input: PayrollInput,
  brackets: { inss: InssBracket[]; ir: IrBracket[] },
  opts: { manualInss?: number; manualIr?: number } = {}
): ComputedPayroll {
  if (input.salario_sem_dsr != null && input.salario_sem_dsr > 0) {
    input = { ...input, base_salary: calcProventosBase(input.salario_sem_dsr, input.aplica_dobra ?? false) };
  }
  const total_earnings = calcTotalEarnings(input);
  const baseInss = total_earnings - input.family_allowance;
  const autoInss = calcINSS(baseInss, brackets.inss);
  const inss = opts.manualInss != null ? round2(opts.manualInss) : autoInss;

  const baseIr = baseInss - inss;
  const autoIr = calcIR(baseIr, input.dependentes, brackets.ir);
  const ir = opts.manualIr != null ? round2(opts.manualIr) : autoIr;

  const total_deductions = calcTotalDeductions(input, inss, ir);
  const net_amount = round2(total_earnings - total_deductions);

  return { total_earnings, inss, ir, total_deductions, net_amount };
}
