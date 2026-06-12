import { describe, expect, it } from "vitest";
import { calcularFerias } from "./ferias";

const inssFaixas2025 = [
  { ordem: 1, valor_de: 0,       valor_ate: 1518.00, aliquota: 0.075, parcela_deduzir: 0 },
  { ordem: 2, valor_de: 1518.01, valor_ate: 2793.88, aliquota: 0.09,  parcela_deduzir: 22.77 },
  { ordem: 3, valor_de: 2793.89, valor_ate: 4190.83, aliquota: 0.12,  parcela_deduzir: 106.59 },
  { ordem: 4, valor_de: 4190.84, valor_ate: 7786.02, aliquota: 0.14,  parcela_deduzir: 190.37 },
];

const irFaixas2025 = [
  { ordem: 1, valor_de: 0,       valor_ate: 2428.80, aliquota: 0,     parcela_deduzir: 0,      deducao_dependente: 189.59 },
  { ordem: 2, valor_de: 2428.81, valor_ate: 2826.65, aliquota: 0.075, parcela_deduzir: 182.16, deducao_dependente: 189.59 },
  { ordem: 3, valor_de: 2826.66, valor_ate: 3751.05, aliquota: 0.15,  parcela_deduzir: 394.16, deducao_dependente: 189.59 },
  { ordem: 4, valor_de: 3751.06, valor_ate: 4664.68, aliquota: 0.225, parcela_deduzir: 675.49, deducao_dependente: 189.59 },
  { ordem: 5, valor_de: 4664.69, valor_ate: null,     aliquota: 0.275, parcela_deduzir: 908.73, deducao_dependente: 189.59 },
];

const faixas2025 = { inss: inssFaixas2025, ir: irFaixas2025 };

describe("calcularFerias — caso dourado jul/2025 (recibo oficial, SEM redutor)", () => {
  it("base 5531.40 / 30 dias / 0 abono / 0 dep => gozo+terco, INSS 842.11, IRRF 887.87, liquido 5645.22", () => {
    const r = calcularFerias({
      base: 5531.40,
      diasGozo: 30,
      diasAbono: 0,
      diasDireito: 30,
      dependentes: 0,
      faixas: faixas2025,
      redutor: null,
    });

    const lanc = Object.fromEntries(r.lancamentos.map((l) => [l.rubrica_codigo, l.valor]));

    expect(lanc["ferias_gozo"]).toBe(5531.40);
    expect(lanc["ferias_terco"]).toBeCloseTo(1843.80, 2);
    expect(r.base_inss).toBeCloseTo(7375.20, 2);

    expect(lanc["inss_ferias"]).toBeCloseTo(842.11, 1);

    expect(lanc["irrf_ferias"]).toBeCloseTo(887.87, 2);

    expect(r.liquido).toBeCloseTo(5645.22, 1);
  });
});
