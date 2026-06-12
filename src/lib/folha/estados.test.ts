import { describe, expect, it } from "vitest";
import { podeTransicionar } from "@/lib/folha/estados";

describe("estados da run", () => {
  it("fluxo feliz", () => {
    expect(podeTransicionar("rascunho", "aprovada")).toBe(true);
    expect(podeTransicionar("aprovada", "paga")).toBe(true);
    expect(podeTransicionar("paga", "fechada")).toBe(true);
  });

  it("bloqueia pulos e retrocessos", () => {
    expect(podeTransicionar("rascunho", "paga")).toBe(false);
    expect(podeTransicionar("fechada", "rascunho")).toBe(false);
    expect(podeTransicionar("aprovada", "rascunho")).toBe(false);
  });

  it("rascunho permite em_revisao", () => {
    expect(podeTransicionar("rascunho", "em_revisao")).toBe(true);
  });

  it("em_revisao permite voltar a rascunho", () => {
    expect(podeTransicionar("em_revisao", "rascunho")).toBe(true);
  });

  it("fechada nao permite nenhuma transicao", () => {
    expect(podeTransicionar("fechada", "paga")).toBe(false);
    expect(podeTransicionar("fechada", "aprovada")).toBe(false);
  });

  it("estado desconhecido retorna false", () => {
    expect(podeTransicionar("inexistente", "aprovada")).toBe(false);
  });
});
