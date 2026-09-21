import { describe, it, expect } from "vitest";
import {
  totalReceitasPagas,
  totalDespesasPagas,
  saldoCaixa,
  totalReceitas,
  totalDespesas,
  totalAberto,
  totalVencido,
  type LancamentoTotalInput
} from "./totals";

const ONTEM = "2000-01-01"; // vencimento no passado -> 'vencida' quando aberta
const FUTURO = "2999-12-31"; // vencimento no futuro -> continua 'aberta'

function row(p: Partial<LancamentoTotalInput>): LancamentoTotalInput {
  return {
    tipo: "despesa",
    valor: 100,
    status: "aberta",
    data_vencimento: FUTURO,
    data_pagamento: null,
    ...p
  };
}

describe("totals do livro-razão", () => {
  it("soma receitas pagas (regime caixa)", () => {
    const rows = [
      row({ tipo: "receita", status: "paga", valor: 300, data_pagamento: "2026-06-10" }),
      row({ tipo: "receita", status: "aberta", valor: 999 }), // não paga -> fora
      row({ tipo: "despesa", status: "paga", valor: 50, data_pagamento: "2026-06-10" })
    ];
    expect(totalReceitasPagas(rows)).toBe(300);
  });

  it("soma despesas pagas (regime caixa)", () => {
    const rows = [
      row({ tipo: "despesa", status: "paga", valor: 80, data_pagamento: "2026-06-10" }),
      row({ tipo: "despesa", status: "aberta", valor: 20 })
    ];
    expect(totalDespesasPagas(rows)).toBe(80);
  });

  it("saldo de caixa = receitas pagas − despesas pagas", () => {
    const rows = [
      row({ tipo: "receita", status: "paga", valor: 500, data_pagamento: "2026-06-10" }),
      row({ tipo: "despesa", status: "paga", valor: 200, data_pagamento: "2026-06-10" })
    ];
    expect(saldoCaixa(rows)).toBe(300);
  });

  it("totalReceitas/totalDespesas ignoram canceladas", () => {
    const rows = [
      row({ tipo: "receita", status: "paga", valor: 100, data_pagamento: "2026-06-10" }),
      row({ tipo: "receita", status: "cancelada", valor: 777 }),
      row({ tipo: "despesa", status: "aberta", valor: 40 }),
      row({ tipo: "despesa", status: "cancelada", valor: 888 })
    ];
    expect(totalReceitas(rows)).toBe(100);
    expect(totalDespesas(rows)).toBe(40);
  });

  it("totalAberto conta só não-vencidas abertas", () => {
    const rows = [
      row({ status: "aberta", valor: 10, data_vencimento: FUTURO }),
      row({ status: "aberta", valor: 20, data_vencimento: ONTEM }) // vencida -> fora
    ];
    expect(totalAberto(rows)).toBe(10);
  });

  it("totalVencido conta abertas com vencimento passado", () => {
    const rows = [
      row({ status: "aberta", valor: 70, data_vencimento: ONTEM }),
      row({ status: "paga", valor: 30, data_vencimento: ONTEM, data_pagamento: "2026-06-10" })
    ];
    expect(totalVencido(rows)).toBe(70);
  });

  it("lista vazia retorna zero em todos os totais", () => {
    expect(totalReceitasPagas([])).toBe(0);
    expect(saldoCaixa([])).toBe(0);
    expect(totalVencido([])).toBe(0);
  });
});
