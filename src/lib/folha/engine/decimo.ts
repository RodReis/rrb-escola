import { calcINSS, type InssBracket, type IrBracket } from "@/lib/payroll/calculators";
import { calcIrrf2026, type RedutorIrrf } from "./irrf";
import type { LancamentoCalculado, ValidacaoItem } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ResultadoEspecial = {
  lancamentos: LancamentoCalculado[];
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  base_inss: number;
  base_irrf: number;
  base_fgts: number;
  validacoes: ValidacaoItem[];
};

function montar(lancamentos: LancamentoCalculado[], tipos: Record<string, "provento" | "desconto">,
  bases: { inss: number; irrf: number; fgts: number }, validacoes: ValidacaoItem[]): ResultadoEspecial {
  const total_proventos = round2(lancamentos.filter((l) => tipos[l.rubrica_codigo] === "provento")
    .reduce((a, l) => a + l.valor, 0));
  const total_descontos = round2(lancamentos.filter((l) => tipos[l.rubrica_codigo] === "desconto")
    .reduce((a, l) => a + l.valor, 0));
  return {
    lancamentos, total_proventos, total_descontos,
    liquido: round2(total_proventos - total_descontos),
    base_inss: bases.inss, base_irrf: bases.irrf, base_fgts: bases.fgts, validacoes,
  };
}

export function calcularDecimo1a(args: { base: number; avos: number }): ResultadoEspecial {
  const validacoes: ValidacaoItem[] = [];
  if (args.avos < 0 || args.avos > 12) validacoes.push({ nivel: "erro", mensagem: `Avos inválido: ${args.avos}` });
  if (args.base <= 0) validacoes.push({ nivel: "erro", mensagem: "Base do 13º zerada" });
  const valor = round2((args.base / 2) * (args.avos / 12));
  const lancamentos: LancamentoCalculado[] = [
    { rubrica_codigo: "decimo_1a_parcela", referencia: `${args.avos}/12 avos`, valor, origem: "auto" },
  ];
  return montar(lancamentos, { decimo_1a_parcela: "provento" }, { inss: 0, irrf: 0, fgts: valor }, validacoes);
}

export function calcularDecimo2a(args: {
  base: number; avos: number; valor1aPaga: number; dependentes: number;
  faixas: { inss: InssBracket[]; ir: IrBracket[] }; redutor: RedutorIrrf | null;
}): ResultadoEspecial {
  const validacoes: ValidacaoItem[] = [];
  if (args.avos < 0 || args.avos > 12) validacoes.push({ nivel: "erro", mensagem: `Avos inválido: ${args.avos}` });
  if (args.base <= 0) validacoes.push({ nivel: "erro", mensagem: "Base do 13º zerada" });

  const cheio = round2(args.base * (args.avos / 12));
  const inss13 = calcINSS(cheio, args.faixas.inss);
  const baseIrrf = round2(Math.max(0, cheio - inss13));
  const irrf13 = calcIrrf2026({
    baseIr: baseIrrf, rendimento: cheio, dependentes: args.dependentes,
    faixas: args.faixas.ir, redutor: args.redutor,
  });

  const tipos: Record<string, "provento" | "desconto"> = {
    decimo_2a_parcela: "provento", inss_13: "desconto", irrf_13: "desconto",
    desconto_adiantamento_13: "desconto",
  };
  const lancamentos: LancamentoCalculado[] = [
    { rubrica_codigo: "decimo_2a_parcela", referencia: `${args.avos}/12 avos`, valor: cheio, origem: "auto" },
    { rubrica_codigo: "inss_13", referencia: null, valor: inss13, origem: "auto" },
    { rubrica_codigo: "irrf_13", referencia: null, valor: irrf13, origem: "auto" },
  ];
  if (args.valor1aPaga > 0) {
    lancamentos.push({ rubrica_codigo: "desconto_adiantamento_13", referencia: null,
      valor: round2(args.valor1aPaga), origem: "auto" });
  }
  return montar(lancamentos, tipos, { inss: cheio, irrf: baseIrrf, fgts: cheio }, validacoes);
}
