import { describe, expect, it } from "vitest";
import { calcIrrf2026 } from "./irrf";

const faixas = [
  { ordem: 1, valor_de: 0, valor_ate: 2428.8, aliquota: 0, parcela_deduzir: 0, deducao_dependente: 189.59 },
  { ordem: 2, valor_de: 2428.8, valor_ate: 2826.65, aliquota: 0.075, parcela_deduzir: 182.16, deducao_dependente: 189.59 },
  { ordem: 3, valor_de: 2826.65, valor_ate: 3751.05, aliquota: 0.15, parcela_deduzir: 394.16, deducao_dependente: 189.59 },
  { ordem: 4, valor_de: 3751.05, valor_ate: 4664.68, aliquota: 0.225, parcela_deduzir: 675.49, deducao_dependente: 189.59 },
  { ordem: 5, valor_de: 4664.68, valor_ate: null, aliquota: 0.275, parcela_deduzir: 908.73, deducao_dependente: 189.59 },
];
const redutor = { limite_isencao: 5000, limite_reducao: 7350 };

describe("calcIrrf2026", () => {
  it("isento total quando rendimento <= 5000", () => {
    expect(calcIrrf2026({ baseIr: 4800, rendimento: 5000, dependentes: 0, faixas, redutor })).toBe(0);
  });
  it("imposto integral quando rendimento > 7350", () => {
    const cheio = calcIrrf2026({ baseIr: 8000, rendimento: 8000, dependentes: 0, faixas, redutor });
    expect(cheio).toBeCloseTo(8000 * 0.275 - 908.73, 2);
  });
  it("zona de redução: imposto entre 0 e o integral, crescente", () => {
    const a = calcIrrf2026({ baseIr: 5500, rendimento: 5500, dependentes: 0, faixas, redutor });
    const b = calcIrrf2026({ baseIr: 6500, rendimento: 6500, dependentes: 0, faixas, redutor });
    const cheioB = 6500 * 0.275 - 908.73;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(cheioB);
  });
  it("borda exata 7350: redutor zera", () => {
    const v = calcIrrf2026({ baseIr: 7350, rendimento: 7350, dependentes: 0, faixas, redutor });
    expect(v).toBeCloseTo(7350 * 0.275 - 908.73, 2);
  });
});
