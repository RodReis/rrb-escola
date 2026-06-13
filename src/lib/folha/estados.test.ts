import { describe, expect, it } from "vitest";
import { podeTransicionar } from "@/lib/folha/estados";

describe("estados da run", () => {
  it("fluxo feliz iniciada→aprovado", () => {
    expect(podeTransicionar("iniciada", "em_andamento")).toBe(true);
    expect(podeTransicionar("em_andamento", "revisao")).toBe(true);
    expect(podeTransicionar("revisao", "aprovacao")).toBe(true);
    expect(podeTransicionar("aprovacao", "aprovado")).toBe(true);
  });

  it("back-transitions permitidas", () => {
    expect(podeTransicionar("em_andamento", "iniciada")).toBe(true);
    expect(podeTransicionar("revisao", "em_andamento")).toBe(true);
    expect(podeTransicionar("aprovacao", "revisao")).toBe(true);
  });

  it("bloqueia pulos e retrocessos inválidos", () => {
    expect(podeTransicionar("iniciada", "revisao")).toBe(false);
    expect(podeTransicionar("iniciada", "aprovado")).toBe(false);
    expect(podeTransicionar("aprovado", "iniciada")).toBe(false);
    expect(podeTransicionar("aprovado", "revisao")).toBe(false);
  });

  it("aprovado não permite nenhuma transição", () => {
    expect(podeTransicionar("aprovado", "aprovacao")).toBe(false);
    expect(podeTransicionar("aprovado", "em_andamento")).toBe(false);
  });

  it("estado desconhecido retorna false", () => {
    expect(podeTransicionar("inexistente", "aprovado")).toBe(false);
  });
});
