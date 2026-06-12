import { describe, expect, it } from "vitest";
import { calcularDecimo1a, calcularDecimo2a } from "./decimo";

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
const faixas = { inss: inssFaixas, ir: irFaixas };

describe("calcularDecimo1a", () => {
  it("metade da base proporcional aos avos, sem descontos", () => {
    const r = calcularDecimo1a({ base: 3000, avos: 12 });
    expect(r.lancamentos).toEqual([
      { rubrica_codigo: "decimo_1a_parcela", referencia: "12/12 avos", valor: 1500, origem: "auto" },
    ]);
    expect(r.liquido).toBe(1500);
  });
  it("avos parciais: 6/12", () => {
    const r = calcularDecimo1a({ base: 3000, avos: 6 });
    expect(r.lancamentos[0].valor).toBe(750);
  });
});

describe("calcularDecimo2a", () => {
  it("13o cheio - 1a parcela, INSS e IRRF sobre o 13o total (exclusivo)", () => {
    const r = calcularDecimo2a({ base: 3000, avos: 12, valor1aPaga: 1500, dependentes: 0, faixas, redutor });
    const cheio = 3000;
    const lanc = Object.fromEntries(r.lancamentos.map((l) => [l.rubrica_codigo, l.valor]));
    expect(lanc["decimo_2a_parcela"]).toBe(cheio);
    expect(lanc["desconto_adiantamento_13"]).toBe(1500);
    expect(lanc["inss_13"]).toBeCloseTo(1621 * 0.075 + (2902.84 - 1621) * 0.09 + (3000 - 2902.84) * 0.12, 2);
    expect(lanc["irrf_13"]).toBe(0);
    expect(r.liquido).toBeCloseTo(cheio - 1500 - lanc["inss_13"], 2);
  });
  it("sem 1a paga nao gera desconto", () => {
    const r = calcularDecimo2a({ base: 3000, avos: 12, valor1aPaga: 0, dependentes: 0, faixas, redutor });
    expect(r.lancamentos.find((l) => l.rubrica_codigo === "desconto_adiantamento_13")).toBeUndefined();
  });
  it("redutor Lei 15.270 aplica no 13o (rendimento 5500 na zona de reducao)", () => {
    const r = calcularDecimo2a({ base: 5500, avos: 12, valor1aPaga: 0, dependentes: 0, faixas, redutor });
    const irrf = r.lancamentos.find((l) => l.rubrica_codigo === "irrf_13")!.valor;
    expect(irrf).toBeGreaterThan(0);
    const inss13 = r.lancamentos.find((l) => l.rubrica_codigo === "inss_13")!.valor;
    const cheioTabela = (5500 - inss13) * 0.275 - 908.73;
    expect(irrf).toBeLessThan(cheioTabela);
  });
  it("validacao: avos fora de 0-12", () => {
    const r = calcularDecimo2a({ base: 3000, avos: 13, valor1aPaga: 0, dependentes: 0, faixas, redutor });
    expect(r.validacoes.some((v) => v.nivel === "erro")).toBe(true);
  });
});
