import { describe, it, expect } from "vitest";
import { calcularOrdem, ordensDeColuna } from "./ordenacao";

describe("calcularOrdem", () => {
  it("retorna 1 para lista vazia", () => {
    expect(calcularOrdem([], 0)).toBe(1);
  });

  it("insere no início (antes do primeiro)", () => {
    expect(calcularOrdem([2, 4, 6], 0)).toBe(1); // 2 - 1
  });

  it("insere no fim (depois do último)", () => {
    expect(calcularOrdem([2, 4, 6], 3)).toBe(7); // 6 + 1
  });

  it("insere entre dois elementos", () => {
    expect(calcularOrdem([2, 6], 1)).toBe(4); // (2 + 6) / 2
  });

  it("produz fração entre valores próximos", () => {
    const resultado = calcularOrdem([1, 1.5], 1);
    expect(resultado).toBe(1.25); // (1 + 1.5) / 2
  });

  it("insere entre 0.5 e 0.75", () => {
    const resultado = calcularOrdem([0.5, 0.75], 1);
    expect(resultado).toBe(0.625);
  });
});

describe("ordensDeColuna", () => {
  const cards = [
    { id: "a", ordem: 3 },
    { id: "b", ordem: 1 },
    { id: "c", ordem: 2 },
  ];

  it("retorna ordens em ordem crescente", () => {
    expect(ordensDeColuna(cards)).toEqual([1, 2, 3]);
  });

  it("exclui o card especificado", () => {
    expect(ordensDeColuna(cards, "b")).toEqual([2, 3]);
  });

  it("retorna array vazio para lista vazia", () => {
    expect(ordensDeColuna([])).toEqual([]);
  });
});
