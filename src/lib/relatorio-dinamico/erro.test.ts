import { describe, it, expect } from "vitest";
import { mensagemDeErro } from "./erro";

describe("mensagemDeErro", () => {
  it("extrai .message de instância de Error", () => {
    expect(mensagemDeErro(new Error("falha real"))).toBe("falha real");
  });
  it("extrai .message de erro do Supabase (PostgrestError não é instância de Error)", () => {
    // Formato real do supabase-js: { message, details, hint, code }, um objeto plano.
    const erroPostgrest = { message: "permission denied for table employees", details: null, hint: null, code: "42501" };
    expect(mensagemDeErro(erroPostgrest)).toBe("permission denied for table employees");
  });
  it("cai no texto genérico quando não há .message nenhum", () => {
    expect(mensagemDeErro("string qualquer")).toBe("Erro inesperado ao gerar o relatório.");
    expect(mensagemDeErro(null)).toBe("Erro inesperado ao gerar o relatório.");
    expect(mensagemDeErro({})).toBe("Erro inesperado ao gerar o relatório.");
  });
  it("ignora .message vazio ou não-string", () => {
    expect(mensagemDeErro({ message: "" })).toBe("Erro inesperado ao gerar o relatório.");
    expect(mensagemDeErro({ message: 42 })).toBe("Erro inesperado ao gerar o relatório.");
  });
});
