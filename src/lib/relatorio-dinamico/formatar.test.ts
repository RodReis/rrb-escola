import { describe, it, expect } from "vitest";
import { fmtData, fmtMoeda, idade, juntar, normalizarTexto, primeiroNome, txt } from "./formatar";

describe("formatar", () => {
  it("fmtData converte ISO sem deslocar fuso", () => {
    expect(fmtData("2015-03-10")).toBe("10/03/2015");
    expect(fmtData("2015-03-10T00:00:00Z")).toBe("10/03/2015");
    expect(fmtData(null)).toBe("");
  });
  it("fmtMoeda usa pt-BR", () => {
    expect(fmtMoeda(1234.5)).toMatch(/^R\$\s1\.234,50$/);
    expect(fmtMoeda(null)).toBe("");
  });
  it("idade considera se o aniversário já passou", () => {
    const hoje = new Date(2026, 8, 25);
    expect(idade("2015-09-25", hoje)).toBe("11");
    expect(idade("2015-09-26", hoje)).toBe("10");
    expect(idade(null, hoje)).toBe("");
  });
  it("juntar ignora vazios e separa com ' / '", () => {
    expect(juntar(["a", null, " ", "b"])).toBe("a / b");
  });
  it("normalizarTexto remove acento e caixa", () => {
    expect(normalizarTexto(" Mãe ")).toBe("mae");
  });
  it("primeiroNome", () => {
    expect(primeiroNome("ana michele vieira")).toBe("ANA");
  });
  it("txt trata null/number", () => {
    expect(txt(null)).toBe("");
    expect(txt(3)).toBe("3");
    expect(txt("  x ")).toBe("x");
  });
});
