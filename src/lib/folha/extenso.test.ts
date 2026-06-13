import { describe, it, expect } from "vitest";
import { valorPorExtenso } from "./extenso";

describe("valorPorExtenso", () => {
  it("converte 1.00 → um real", () => {
    expect(valorPorExtenso(1.00)).toBe("um real");
  });

  it("converte 0.50 → cinquenta centavos", () => {
    expect(valorPorExtenso(0.50)).toBe("cinquenta centavos");
  });

  it("converte 0.01 → um centavo", () => {
    expect(valorPorExtenso(0.01)).toBe("um centavo");
  });

  it("converte 2.00 → dois reais", () => {
    expect(valorPorExtenso(2.00)).toBe("dois reais");
  });

  it("converte 1000.00 → mil reais", () => {
    expect(valorPorExtenso(1000.00)).toBe("mil reais");
  });

  it("converte 2541.00 → dois mil quinhentos e quarenta e um reais", () => {
    expect(valorPorExtenso(2541.00)).toBe("dois mil quinhentos e quarenta e um reais");
  });

  it("converte 5645.22 → cinco mil seiscentos e quarenta e cinco reais e vinte e dois centavos (âncora ADENDO 1)", () => {
    expect(valorPorExtenso(5645.22)).toBe(
      "cinco mil seiscentos e quarenta e cinco reais e vinte e dois centavos"
    );
  });

  it("converte 100000.00 → cem mil reais", () => {
    expect(valorPorExtenso(100000.00)).toBe("cem mil reais");
  });

  it("converte 1843.80 → mil oitocentos e quarenta e três reais e oitenta centavos", () => {
    expect(valorPorExtenso(1843.80)).toBe(
      "mil oitocentos e quarenta e três reais e oitenta centavos"
    );
  });

  it("converte 21.01 → vinte e um reais e um centavo", () => {
    expect(valorPorExtenso(21.01)).toBe("vinte e um reais e um centavo");
  });

  it("converte 200.00 → duzentos reais", () => {
    expect(valorPorExtenso(200.00)).toBe("duzentos reais");
  });

  it("converte 500.50 → quinhentos reais e cinquenta centavos", () => {
    expect(valorPorExtenso(500.50)).toBe("quinhentos reais e cinquenta centavos");
  });
});
