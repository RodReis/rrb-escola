import { describe, expect, it } from "vitest";
import { normalizeNome } from "./normalize-nome";

describe("normalizeNome", () => {
  it("remove acentos", () => {
    expect(normalizeNome("CÔRTES")).toBe("cortes");
  });

  it("resultado bate independente de acento no input", () => {
    expect(normalizeNome("José")).toBe(normalizeNome("Jose"));
  });

  it("lowercase", () => {
    expect(normalizeNome("MARIA")).toBe("maria");
  });

  it("trim espaços nas pontas", () => {
    expect(normalizeNome("  Ana  ")).toBe("ana");
  });

  it("null/undefined vira string vazia", () => {
    expect(normalizeNome(null)).toBe("");
    expect(normalizeNome(undefined)).toBe("");
  });

  it("cedilha", () => {
    expect(normalizeNome("MARÇAL")).toBe("marcal");
  });
});
