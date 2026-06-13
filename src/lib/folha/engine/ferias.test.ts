import { describe, expect, it } from "vitest";
import { calcularFerias, descontoGozoNaMensal } from "./ferias";

const inssFaixas = [
  { ordem: 1, valor_de: 0, valor_ate: 1621.0, aliquota: 0.075, parcela_deduzir: 0 },
  { ordem: 2, valor_de: 1621.0, valor_ate: 2902.84, aliquota: 0.09, parcela_deduzir: 0 },
  { ordem: 3, valor_de: 2902.84, valor_ate: 4354.27, aliquota: 0.12, parcela_deduzir: 0 },
  { ordem: 4, valor_de: 4354.27, valor_ate: 8475.55, aliquota: 0.14, parcela_deduzir: 0 },
];
const irFaixas = [
  { ordem: 1, valor_de: 0, valor_ate: 2428.8, aliquota: 0, parcela_deduzir: 0, deducao_dependente: 189.59 },
  { ordem: 5, valor_de: 4664.68, valor_ate: null, aliquota: 0.275, parcela_deduzir: 908.73, deducao_dependente: 189.59 },
];
const redutor = { limite_isencao: 5000, limite_reducao: 7350, coef_fixo: 978.62, coef_mult: 0.133145 };
const faixas = { inss: inssFaixas, ir: irFaixas };

describe("calcularFerias", () => {
  it("30 dias sem abono: gozo + 1/3, INSS/IRRF sobre gozo+terco", () => {
    const r = calcularFerias({ base: 3000, diasGozo: 30, diasAbono: 0, diasDireito: 30,
      dependentes: 0, faixas, redutor });
    const lanc = Object.fromEntries(r.lancamentos.map((l) => [l.rubrica_codigo, l.valor]));
    expect(lanc["ferias_gozo"]).toBe(3000);
    expect(lanc["ferias_terco"]).toBe(1000);
    expect(r.base_inss).toBe(4000);
    expect(lanc["inss_13"]).toBeUndefined();
    expect(lanc["inss_ferias"]).toBeGreaterThan(0);
  });
  it("20 dias + 10 de abono: abono e seu terco sem incidencias", () => {
    const r = calcularFerias({ base: 3000, diasGozo: 20, diasAbono: 10, diasDireito: 30,
      dependentes: 0, faixas, redutor });
    const lanc = Object.fromEntries(r.lancamentos.map((l) => [l.rubrica_codigo, l.valor]));
    expect(lanc["ferias_gozo"]).toBe(2000);
    expect(lanc["ferias_terco"]).toBeCloseTo(666.67, 2);
    expect(lanc["abono_pecuniario"]).toBe(1000);
    expect(lanc["abono_terco"]).toBeCloseTo(333.33, 2);
    expect(r.base_inss).toBeCloseTo(2666.67, 2);
  });
  it("gozo+abono > direito = erro", () => {
    const r = calcularFerias({ base: 3000, diasGozo: 25, diasAbono: 10, diasDireito: 30,
      dependentes: 0, faixas, redutor });
    expect(r.validacoes.some((v) => v.nivel === "erro")).toBe(true);
  });
});

describe("descontoGozoNaMensal", () => {
  it("desconta os dias do mes ja pagos no recibo", () => {
    expect(descontoGozoNaMensal(3000, 20)).toBe(2000);
  });
  it("zero dias = zero", () => {
    expect(descontoGozoNaMensal(3000, 0)).toBe(0);
  });
});
