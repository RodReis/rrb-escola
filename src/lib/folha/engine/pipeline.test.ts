import { describe, expect, it } from "vitest";
import { calcularItem } from "./pipeline";
import type { ContratoCalculo, PerfilRubrica, RubricaDef } from "./types";

function rub(codigo: string, tipo: RubricaDef["tipo"], metodo: string, flags: Partial<RubricaDef> = {}): RubricaDef {
  return {
    id: codigo, codigo, nome: codigo, tipo, metodo_calculo: metodo,
    incide_inss: false, incide_irrf: false, incide_fgts: false, incide_dsr: false,
    ordem_holerite: 100, ...flags,
  };
}
function pr(rubrica: RubricaDef, ordem: number): PerfilRubrica {
  return { rubrica, automatica: true, ordem_execucao: ordem };
}

const RUB = {
  horaAula: rub("hora_aula", "provento", "hora_aula", { incide_inss: true, incide_irrf: true, incide_fgts: true, incide_dsr: true }),
  dobra: rub("salario_dobra", "provento", "valor_contratual", { incide_inss: true, incide_irrf: true, incide_fgts: true, incide_dsr: true }),
  dsr: rub("dsr", "provento", "dsr", { incide_inss: true, incide_irrf: true, incide_fgts: true }),
  horaAtiv: rub("hora_atividade", "provento", "hora_atividade", { incide_inss: true, incide_irrf: true, incide_fgts: true }),
  inss: rub("inss", "desconto", "inss"),
  inssRpa: rub("inss_rpa", "desconto", "inss_rpa"),
  irrf: rub("irrf", "desconto", "irrf"),
  fgts: rub("fgts", "informativa", "fgts"),
  patronal: rub("inss_patronal", "informativa", "inss_patronal"),
  prov13: rub("provisao_13", "informativa", "provisao_13"),
  provFerias: rub("provisao_ferias", "informativa", "provisao_ferias"),
  valorServico: rub("valor_servico", "provento", "salario_base"),
  bolsa: rub("bolsa_estagio", "provento", "salario_base"),
  salarioBase: rub("salario_base", "provento", "salario_base", { incide_inss: true, incide_irrf: true, incide_fgts: true }),
};

const inssFaixas = [
  { ordem: 1, valor_de: 0, valor_ate: 1621.0, aliquota: 0.075, parcela_deduzir: 0 },
  { ordem: 2, valor_de: 1621.0, valor_ate: 2902.84, aliquota: 0.09, parcela_deduzir: 0 },
  { ordem: 3, valor_de: 2902.84, valor_ate: 4354.27, aliquota: 0.12, parcela_deduzir: 0 },
  { ordem: 4, valor_de: 4354.27, valor_ate: 8475.55, aliquota: 0.14, parcela_deduzir: 0 },
];
const irFaixas = [
  { ordem: 1, valor_de: 0, valor_ate: 2428.8, aliquota: 0, parcela_deduzir: 0, deducao_dependente: 189.59 },
  { ordem: 2, valor_de: 2428.8, valor_ate: 2826.65, aliquota: 0.075, parcela_deduzir: 182.16, deducao_dependente: 189.59 },
  { ordem: 3, valor_de: 2826.65, valor_ate: 3751.05, aliquota: 0.15, parcela_deduzir: 394.16, deducao_dependente: 189.59 },
  { ordem: 4, valor_de: 3751.05, valor_ate: 4664.68, aliquota: 0.225, parcela_deduzir: 675.49, deducao_dependente: 189.59 },
  { ordem: 5, valor_de: 4664.68, valor_ate: null, aliquota: 0.275, parcela_deduzir: 908.73, deducao_dependente: 189.59 },
];
const redutor = { limite_isencao: 5000, limite_reducao: 7350, coef_fixo: 978.62, coef_mult: 0.133145 };
const config = { divisor_dsr: 6, percentual_hora_atividade: 0, semanas_mes: 4.5 };

describe("calcularItem — professor com dobra (Ana Flávia)", () => {
  const contrato: ContratoCalculo = {
    id: "c1", salario_base: null, valor_hora_aula: 27.0168, aulas_semanais: 20,
    dependentes_irrf: 0, verbas: [{ rubrica_codigo: "salario_dobra", valor: 2457.51, percentual: null }],
  };
  const perfil = [pr(RUB.horaAula, 10), pr(RUB.dobra, 20), pr(RUB.dsr, 30), pr(RUB.horaAtiv, 40),
    pr(RUB.inss, 60), pr(RUB.irrf, 61), pr(RUB.fgts, 80), pr(RUB.patronal, 81),
    pr(RUB.prov13, 82), pr(RUB.provFerias, 83)];

  const r = calcularItem({ contrato, perfilRubricas: perfil, config, manuais: [],
    faixas: { inss: inssFaixas, ir: irFaixas }, redutor });

  it("hora-aula = 27,0168 x 20 x 4,5 = 2431,51", () => {
    expect(r.lancamentos.find((l) => l.rubrica_codigo === "hora_aula")?.valor).toBe(2431.51);
  });
  it("DSR em duas linhas: 486,30 (base) + 491,50 (dobra)", () => {
    const dsrs = r.lancamentos.filter((l) => l.rubrica_codigo === "dsr").map((l) => l.valor).sort();
    expect(dsrs).toEqual([486.3, 491.5]);
  });
  it("total proventos = 2431,51 + 2457,51 + 486,30 + 491,50 = 5866,82", () => {
    expect(r.total_proventos).toBe(5866.82);
  });
  it("bases INSS/IRRF/FGTS = total proventos (todas as rubricas incidem)", () => {
    expect(r.base_inss).toBe(5866.82);
    expect(r.base_fgts).toBe(5866.82);
  });
  it("INSS progressivo sobre 5866,82 com faixas fixture", () => {
    const esperado = 1621 * 0.075 + (2902.84 - 1621) * 0.09 + (4354.27 - 2902.84) * 0.12 + (5866.82 - 4354.27) * 0.14;
    expect(r.lancamentos.find((l) => l.rubrica_codigo === "inss")?.valor).toBeCloseTo(esperado, 2);
  });
  it("liquido = proventos - descontos; FGTS informativo nao reduz liquido", () => {
    expect(r.liquido).toBeCloseTo(r.total_proventos - r.total_descontos, 2);
    expect(r.encargos.fgts).toBeCloseTo(5866.82 * 0.08, 2);
  });
  it("provisoes: 13o = 1/12 da base; ferias = (base x 4/3)/12", () => {
    expect(r.encargos.provisao_13).toBeCloseTo(5866.82 / 12, 2);
    expect(r.encargos.provisao_ferias).toBeCloseTo((5866.82 * 4) / 3 / 12, 2);
  });
});

describe("calcularItem — RPA", () => {
  const contrato: ContratoCalculo = { id: "c2", salario_base: 3000, valor_hora_aula: null,
    aulas_semanais: null, dependentes_irrf: 0, verbas: [] };
  const perfil = [pr(RUB.valorServico, 10), pr(RUB.inssRpa, 60), pr(RUB.irrf, 61), pr(RUB.patronal, 81)];
  const r = calcularItem({ contrato, perfilRubricas: perfil, config, manuais: [],
    faixas: { inss: inssFaixas, ir: irFaixas }, redutor });
  it("INSS 11% fixo sobre o bruto (ate o teto)", () => {
    expect(r.lancamentos.find((l) => l.rubrica_codigo === "inss_rpa")?.valor).toBe(330);
  });
  it("INSS patronal 20% informativo", () => {
    expect(r.encargos.inss_patronal).toBe(600);
  });
  it("sem FGTS nem provisoes", () => {
    expect(r.encargos.fgts).toBe(0);
    expect(r.encargos.provisao_13).toBe(0);
  });
});

describe("calcularItem — validacoes", () => {
  it("liquido negativo gera erro bloqueante", () => {
    const contrato: ContratoCalculo = { id: "c3", salario_base: 100, valor_hora_aula: null,
      aulas_semanais: null, dependentes_irrf: 0, verbas: [] };
    const perfil = [pr(RUB.salarioBase, 10), pr(RUB.inss, 60)];
    const r = calcularItem({ contrato, perfilRubricas: perfil, config,
      manuais: [{ rubrica_codigo: "adiantamento", valor: 500, origem: "manual" }],
      faixas: { inss: inssFaixas, ir: irFaixas }, redutor,
      rubricasExtras: [rub("adiantamento", "desconto", "manual")] });
    expect(r.liquido).toBeLessThan(0);
    expect(r.validacoes.some((v) => v.nivel === "erro")).toBe(true);
  });
  it("contrato sem salario nem hora-aula gera erro", () => {
    const contrato: ContratoCalculo = { id: "c4", salario_base: null, valor_hora_aula: null,
      aulas_semanais: null, dependentes_irrf: 0, verbas: [] };
    const r = calcularItem({ contrato, perfilRubricas: [pr(RUB.salarioBase, 10)], config,
      manuais: [], faixas: { inss: inssFaixas, ir: irFaixas }, redutor });
    expect(r.validacoes.some((v) => v.nivel === "erro")).toBe(true);
  });
});
