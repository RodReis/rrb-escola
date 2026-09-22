import { describe, expect, it } from "vitest";
import { normalizarNomeIsaac } from "./normalizar-nome";

describe("normalizarNomeIsaac", () => {
  it("remove acento e caixa, como lower(immutable_unaccent(nome)) faz no banco", () => {
    expect(normalizarNomeIsaac("CÔRTES")).toBe("cortes");
    expect(normalizarNomeIsaac("Alícia Matias Montelo Souza")).toBe("alicia matias montelo souza");
    expect(normalizarNomeIsaac("João Conceição")).toBe("joao conceicao");
  });

  it("colapsa espaço interno — a coluna gerada não faz isso, por isso a consulta tem que aplicar regexp_replace do outro lado", () => {
    expect(normalizarNomeIsaac("Ana  Silva")).toBe("ana silva");
    expect(normalizarNomeIsaac("Ana\tSilva")).toBe("ana silva");
  });

  it("apara as pontas", () => {
    expect(normalizarNomeIsaac("  Ana Silva  ")).toBe("ana silva");
  });

  it("é idempotente: normalizar o já normalizado não muda nada", () => {
    const uma = normalizarNomeIsaac("  MARIA   DAS  GRAÇAS  ");
    expect(normalizarNomeIsaac(uma)).toBe(uma);
  });

  it("trata null e vazio sem explodir", () => {
    expect(normalizarNomeIsaac(null)).toBe("");
    expect(normalizarNomeIsaac(undefined)).toBe("");
    expect(normalizarNomeIsaac("   ")).toBe("");
  });

  it("não junta nomes diferentes: irmãos com mesmo sobrenome continuam distintos", () => {
    // O caso que proíbe fuzzy automático no importador.
    expect(normalizarNomeIsaac("Laura Rodrigues da Silva")).not.toBe(
      normalizarNomeIsaac("Amanda Rodrigues da Silva"),
    );
  });
});
