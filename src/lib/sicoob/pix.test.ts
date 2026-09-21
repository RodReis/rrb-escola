import { describe, expect, it } from "vitest";
import { extrairCopiaECola, isCopiaEColaValido } from "@/lib/sicoob/pix";

describe("extrairCopiaECola", () => {
  it("lê o campo brcode, que é o nome usado pelo Sicoob", () => {
    expect(extrairCopiaECola({ brcode: "00020126BR" })).toBe("00020126BR");
  });

  it("aceita pixCopiaECola como fallback do padrão Bacen", () => {
    expect(extrairCopiaECola({ pixCopiaECola: "00020126BACEN" })).toBe("00020126BACEN");
  });

  it("cai para loc.brcode quando a raiz não traz o código", () => {
    expect(extrairCopiaECola({ loc: { brcode: "00020126LOC" } })).toBe("00020126LOC");
  });

  it("devolve undefined quando nenhum campo está presente", () => {
    expect(extrairCopiaECola({ txid: "abc", status: "ATIVA" })).toBeUndefined();
  });
});

describe("isCopiaEColaValido", () => {
  const brCodeReal =
    "00020126580014br.gov.bcb.pix0136d7916b23-2608-4567-af9e-bc05e5884c3d5204000053039865802BR5913Escola Teste6009Sao Paulo62070503***6304ABCD";

  it("aceita um BR Code com a forma do padrão EMV", () => {
    expect(isCopiaEColaValido(brCodeReal)).toBe(true);
  });

  it("rejeita o texto fictício devolvido pelo sandbox do Sicoob", () => {
    expect(isCopiaEColaValido("incididunt in eiusmod")).toBe(false);
    expect(isCopiaEColaValido("nostrud")).toBe(false);
  });

  it("rejeita valor ausente ou vazio", () => {
    expect(isCopiaEColaValido(undefined)).toBe(false);
    expect(isCopiaEColaValido("")).toBe(false);
  });

  it("rejeita string que começa com 0002 mas não é do arranjo Pix", () => {
    expect(isCopiaEColaValido("0002".padEnd(120, "x"))).toBe(false);
  });
});
