import { calcINSS, type InssBracket, type IrBracket } from "@/lib/payroll/calculators";
import { calcIrrf2026, type RedutorIrrf } from "./irrf";
import type { LancamentoCalculado, ValidacaoItem } from "./types";
import type { ResultadoEspecial } from "./decimo";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularFerias(args: {
  base: number; diasGozo: number; diasAbono: number; diasDireito: number;
  dependentes: number; faixas: { inss: InssBracket[]; ir: IrBracket[] }; redutor: RedutorIrrf | null;
}): ResultadoEspecial {
  const validacoes: ValidacaoItem[] = [];
  if (args.diasGozo + args.diasAbono > args.diasDireito)
    validacoes.push({ nivel: "erro", mensagem: `Gozo ${args.diasGozo} + abono ${args.diasAbono} > direito ${args.diasDireito}` });
  if (args.base <= 0) validacoes.push({ nivel: "erro", mensagem: "Base de férias zerada" });

  const gozo = round2((args.base / 30) * args.diasGozo);
  const terco = round2(gozo / 3);
  const abono = round2((args.base / 30) * args.diasAbono);
  const abonoTerco = round2(abono / 3);

  const baseInss = round2(gozo + terco);
  const inss = calcINSS(baseInss, args.faixas.inss);
  const baseIrrf = round2(Math.max(0, baseInss - inss));
  const irrf = calcIrrf2026({
    baseIr: baseIrrf, rendimento: baseInss, dependentes: args.dependentes,
    faixas: args.faixas.ir, redutor: args.redutor,
  });

  const lancamentos: LancamentoCalculado[] = [
    { rubrica_codigo: "ferias_gozo", referencia: `${args.diasGozo} dias`, valor: gozo, origem: "auto" },
    { rubrica_codigo: "ferias_terco", referencia: "1/3", valor: terco, origem: "auto" },
  ];
  if (args.diasAbono > 0) {
    lancamentos.push(
      { rubrica_codigo: "abono_pecuniario", referencia: `${args.diasAbono} dias`, valor: abono, origem: "auto" },
      { rubrica_codigo: "abono_terco", referencia: "1/3", valor: abonoTerco, origem: "auto" },
    );
  }
  lancamentos.push(
    { rubrica_codigo: "inss_ferias", referencia: null, valor: inss, origem: "auto" },
    { rubrica_codigo: "irrf_ferias", referencia: null, valor: irrf, origem: "auto" },
  );

  const total_proventos = round2(gozo + terco + abono + abonoTerco);
  const total_descontos = round2(inss + irrf);
  return {
    lancamentos, total_proventos, total_descontos,
    liquido: round2(total_proventos - total_descontos),
    base_inss: baseInss, base_irrf: baseIrrf, base_fgts: baseInss, validacoes,
  };
}

export function descontoGozoNaMensal(base: number, diasGozadosNoMes: number): number {
  if (diasGozadosNoMes <= 0) return 0;
  return round2((base / 30) * diasGozadosNoMes);
}
