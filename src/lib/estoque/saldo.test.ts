import { describe, it, expect } from "vitest";
import {
  sentidoEfetivo,
  deltaMovimento,
  saldoDe,
  movimentoPermitido,
  precisaReposicao,
  type Movimento
} from "./saldo";

describe("estoque/saldo", () => {
  it("entrada força sentido +1", () => {
    expect(sentidoEfetivo("entrada", -1)).toBe(1);
  });

  it("saida força sentido -1", () => {
    expect(sentidoEfetivo("saida", 1)).toBe(-1);
  });

  it("ajuste mantém sentido informado", () => {
    expect(sentidoEfetivo("ajuste", -1)).toBe(-1);
    expect(sentidoEfetivo("ajuste", 1)).toBe(1);
  });

  it("delta = quantidade × sentido efetivo", () => {
    expect(deltaMovimento({ tipo: "entrada", quantidade: 10, sentido: 1 })).toBe(10);
    expect(deltaMovimento({ tipo: "saida", quantidade: 4, sentido: 1 })).toBe(-4); // sentido forçado
    expect(deltaMovimento({ tipo: "ajuste", quantidade: 3, sentido: -1 })).toBe(-3);
  });

  it("saldo: entrada + saída + ajuste", () => {
    const movs: Movimento[] = [
      { tipo: "entrada", quantidade: 20, sentido: 1 },
      { tipo: "saida", quantidade: 5, sentido: -1 },
      { tipo: "ajuste", quantidade: 2, sentido: -1 } // achou 2 a menos
    ];
    expect(saldoDe(movs)).toBe(13);
  });

  it("cancelamento de venda estorna (saída + entrada = 0)", () => {
    const movs: Movimento[] = [
      { tipo: "entrada", quantidade: 10, sentido: 1 },
      { tipo: "saida", quantidade: 3, sentido: -1 },   // venda
      { tipo: "entrada", quantidade: 3, sentido: 1 }   // estorno do cancelamento
    ];
    expect(saldoDe(movs)).toBe(10);
  });

  it("venda a descoberto bloqueada (saída maior que saldo)", () => {
    expect(movimentoPermitido(2, { tipo: "saida", quantidade: 5, sentido: -1 })).toBe(false);
    expect(movimentoPermitido(5, { tipo: "saida", quantidade: 5, sentido: -1 })).toBe(true);
  });

  it("ajuste negativo abaixo de zero bloqueado", () => {
    expect(movimentoPermitido(1, { tipo: "ajuste", quantidade: 3, sentido: -1 })).toBe(false);
  });

  it("reposição: saldo <= mínimo dispara alerta", () => {
    expect(precisaReposicao(2, 5)).toBe(true);
    expect(precisaReposicao(5, 5)).toBe(true);
    expect(precisaReposicao(6, 5)).toBe(false);
  });
});
