import { describe, it, expect } from "vitest";
import {
  subtotalItem,
  somaItens,
  totalVenda,
  cupomObrigatorio,
  vendaValida
} from "./venda-calc";

describe("venda-calc", () => {
  it("subtotal = quantidade × preco_unit", () => {
    expect(subtotalItem({ quantidade: 3, preco_unit: 25 })).toBe(75);
  });

  it("soma de itens", () => {
    expect(somaItens([
      { quantidade: 2, preco_unit: 10 },
      { quantidade: 1, preco_unit: 5 }
    ])).toBe(25);
  });

  it("total = soma − desconto", () => {
    expect(totalVenda([{ quantidade: 2, preco_unit: 50 }], 10)).toBe(90);
  });

  it("cupom obrigatório só quando cartão", () => {
    expect(cupomObrigatorio("cartao")).toBe(true);
    expect(cupomObrigatorio("pix")).toBe(false);
    expect(cupomObrigatorio(null)).toBe(false);
  });

  it("venda sem itens é inválida", () => {
    const r = vendaValida([], 0, "pix", null);
    expect(r.ok).toBe(false);
  });

  it("total não-positivo é inválido (desconto >= soma)", () => {
    const r = vendaValida([{ quantidade: 1, preco_unit: 30 }], 30, "pix", null);
    expect(r.ok).toBe(false);
  });

  it("cartão sem cupom é inválido", () => {
    const r = vendaValida([{ quantidade: 1, preco_unit: 30 }], 0, "cartao", null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("cupom");
  });

  it("cartão com cupom é válido", () => {
    const r = vendaValida([{ quantidade: 1, preco_unit: 30 }], 0, "cartao", "12345");
    expect(r.ok).toBe(true);
  });

  it("venda à vista válida (pix, sem cupom)", () => {
    const r = vendaValida([{ quantidade: 2, preco_unit: 40 }], 5, "pix", null);
    expect(r.ok).toBe(true);
  });
});
