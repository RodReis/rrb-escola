import { calcIR, type IrBracket } from "@/lib/payroll/calculators";

export type RedutorIrrf = { limite_isencao: number; limite_reducao: number; coef_fixo: number; coef_mult: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcIrrf2026(args: {
  baseIr: number;
  rendimento: number;
  dependentes: number;
  faixas: IrBracket[];
  redutor: RedutorIrrf | null;
}): number {
  const integral = calcIR(args.baseIr, args.dependentes, args.faixas);
  if (!args.redutor) return integral;
  const { limite_isencao, limite_reducao, coef_fixo, coef_mult } = args.redutor;
  if (args.rendimento <= limite_isencao) return 0;
  if (args.rendimento >= limite_reducao) return integral;
  const reducao = Math.min(integral, Math.max(0, coef_fixo - coef_mult * args.rendimento));
  return round2(integral - reducao);
}
