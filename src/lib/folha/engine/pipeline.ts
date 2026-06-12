import { calcINSS, type InssBracket, type IrBracket } from "@/lib/payroll/calculators";
import { calcIrrf2026, type RedutorIrrf } from "./irrf";
import { calcDsrSobre, calcHoraAtividade, calcHoraAula } from "./proventos";
import type {
  ContratoCalculo, LancamentoCalculado, LancamentoManual,
  PerfilRubrica, ResultadoItem, RubricaDef, ValidacaoItem,
} from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularItem(args: {
  contrato: ContratoCalculo;
  perfilRubricas: PerfilRubrica[];
  config: { divisor_dsr: number; percentual_hora_atividade: number; semanas_mes: number };
  manuais: LancamentoManual[];
  faixas: { inss: InssBracket[]; ir: IrBracket[] };
  redutor: RedutorIrrf | null;
  rubricasExtras?: RubricaDef[];
}): ResultadoItem {
  const { contrato, config } = args;
  const lancamentos: LancamentoCalculado[] = [];
  const validacoes: ValidacaoItem[] = [];
  const rubricaPorCodigo = new Map<string, RubricaDef>();
  for (const p of args.perfilRubricas) rubricaPorCodigo.set(p.rubrica.codigo, p.rubrica);
  for (const r of args.rubricasExtras ?? []) rubricaPorCodigo.set(r.codigo, r);

  const ordenadas = [...args.perfilRubricas].sort((a, b) => a.ordem_execucao - b.ordem_execucao);
  const encargos = { fgts: 0, inss_patronal: 0, provisao_13: 0, provisao_ferias: 0 };

  const somaPor = (pred: (r: RubricaDef) => boolean) =>
    round2(lancamentos.reduce((acc, l) => {
      const r = rubricaPorCodigo.get(l.rubrica_codigo);
      if (!r || r.tipo !== "provento" || !pred(r)) return acc;
      return acc + l.valor;
    }, 0));

  for (const { rubrica } of ordenadas.filter((p) => p.automatica)) {
    switch (rubrica.metodo_calculo) {
      case "salario_base": {
        if (contrato.salario_base == null) {
          validacoes.push({ nivel: "erro", mensagem: `Contrato sem salário base (${rubrica.codigo})` });
          break;
        }
        lancamentos.push({ rubrica_codigo: rubrica.codigo, referencia: null, valor: round2(contrato.salario_base), origem: "auto" });
        break;
      }
      case "hora_aula": {
        if (contrato.valor_hora_aula == null || contrato.aulas_semanais == null) {
          validacoes.push({ nivel: "erro", mensagem: "Contrato professor sem hora-aula/aulas semanais" });
          break;
        }
        const v = calcHoraAula(contrato.valor_hora_aula, contrato.aulas_semanais, config.semanas_mes);
        lancamentos.push({ rubrica_codigo: rubrica.codigo, referencia: `${contrato.aulas_semanais} aulas`, valor: v, origem: "auto" });
        break;
      }
      case "valor_contratual": {
        const verba = contrato.verbas.find((x) => x.rubrica_codigo === rubrica.codigo);
        if (!verba?.valor) break;
        lancamentos.push({ rubrica_codigo: rubrica.codigo, referencia: null, valor: round2(verba.valor), origem: "auto" });
        break;
      }
      case "dsr": {
        for (const l of [...lancamentos]) {
          const r = rubricaPorCodigo.get(l.rubrica_codigo);
          if (r?.incide_dsr) {
            lancamentos.push({
              rubrica_codigo: rubrica.codigo, referencia: `s/ ${r.nome}`,
              valor: calcDsrSobre(l.valor, config.divisor_dsr), origem: "auto",
            });
          }
        }
        break;
      }
      case "hora_atividade": {
        if (config.percentual_hora_atividade <= 0) break;
        const base = somaPor((r) => r.incide_dsr || r.metodo_calculo === "dsr");
        lancamentos.push({
          rubrica_codigo: rubrica.codigo, referencia: `${config.percentual_hora_atividade}%`,
          valor: calcHoraAtividade(base, config.percentual_hora_atividade), origem: "auto",
        });
        break;
      }
    }
  }

  for (const m of args.manuais) {
    lancamentos.push({
      rubrica_codigo: m.rubrica_codigo, referencia: m.referencia ?? null,
      valor: round2(m.valor), origem: m.origem,
    });
  }

  const base_inss = somaPor((r) => r.incide_inss);
  const base_fgts = somaPor((r) => r.incide_fgts);
  const rendimentoIrrf = somaPor((r) => r.incide_irrf);

  let inssValor = 0;
  for (const { rubrica } of ordenadas.filter((p) => p.automatica)) {
    switch (rubrica.metodo_calculo) {
      case "inss":
        inssValor = calcINSS(base_inss, args.faixas.inss);
        lancamentos.push({ rubrica_codigo: rubrica.codigo, referencia: null, valor: inssValor, origem: "auto" });
        break;
      case "inss_rpa": {
        const teto = args.faixas.inss.reduce((mx, b) => Math.max(mx, b.valor_ate ?? mx), 0);
        const baseRpa = somaPor((r) => r.tipo === "provento");
        inssValor = round2(Math.min(baseRpa, teto || baseRpa) * 0.11);
        lancamentos.push({ rubrica_codigo: rubrica.codigo, referencia: "11%", valor: inssValor, origem: "auto" });
        break;
      }
      case "irrf": {
        const base_irrf = round2(rendimentoIrrf > 0 ? rendimentoIrrf - inssValor
          : somaPor((r) => r.tipo === "provento") - inssValor);
        const v = calcIrrf2026({
          baseIr: base_irrf, rendimento: rendimentoIrrf > 0 ? rendimentoIrrf : base_irrf,
          dependentes: contrato.dependentes_irrf, faixas: args.faixas.ir, redutor: args.redutor,
        });
        lancamentos.push({ rubrica_codigo: rubrica.codigo, referencia: null, valor: v, origem: "auto" });
        break;
      }
      case "percentual_sobre_base": {
        const verba = contrato.verbas.find((x) => x.rubrica_codigo === rubrica.codigo);
        const pct = verba?.percentual;
        if (!pct) break;
        lancamentos.push({
          rubrica_codigo: rubrica.codigo, referencia: `${pct}%`,
          valor: round2(base_inss * (pct / 100)), origem: "auto",
        });
        break;
      }
      case "fgts":
        encargos.fgts = round2(base_fgts * 0.08);
        break;
      case "inss_patronal": {
        const baseTotal = somaPor((r) => r.tipo === "provento");
        encargos.inss_patronal = round2((base_inss > 0 ? base_inss : baseTotal) * 0.2);
        break;
      }
      case "provisao_13":
        encargos.provisao_13 = round2(base_fgts / 12);
        break;
      case "provisao_ferias":
        encargos.provisao_ferias = round2((base_fgts * 4) / 3 / 12);
        break;
    }
  }

  const total_proventos = round2(lancamentos
    .filter((l) => rubricaPorCodigo.get(l.rubrica_codigo)?.tipo === "provento")
    .reduce((a, l) => a + l.valor, 0));
  const total_descontos = round2(lancamentos
    .filter((l) => rubricaPorCodigo.get(l.rubrica_codigo)?.tipo === "desconto")
    .reduce((a, l) => a + l.valor, 0));
  const liquido = round2(total_proventos - total_descontos);
  const base_irrf = round2(Math.max(0, rendimentoIrrf - inssValor));

  if (liquido < 0) validacoes.push({ nivel: "erro", mensagem: "Líquido negativo" });
  if (total_proventos > 0 && base_inss === 0 && rubricaPorCodigo.has("inss"))
    validacoes.push({ nivel: "erro", mensagem: "Provento sem base INSS" });
  if (total_proventos === 0)
    validacoes.push({ nivel: "erro", mensagem: "Contracheque sem proventos" });

  return { lancamentos, total_proventos, total_descontos, liquido, base_inss, base_irrf, base_fgts, encargos, validacoes };
}
