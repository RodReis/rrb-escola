import { describe, expect, it, vi } from "vitest";
import { assertOk } from "./assert-ok";

describe("assertOk", () => {
  it("devolve o data quando a escrita deu certo", () => {
    expect(assertOk({ data: [{ id: "1" }], error: null })).toEqual([{ id: "1" }]);
  });

  it("lanca quando o banco recusou", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => assertOk({ data: null, error: { message: "falhou" } })).toThrow();
  });

  it("traduz os codigos do Postgres que o usuario consegue provocar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const casos: [string, RegExp][] = [
      ["23505", /Já existe um registro/],
      ["23503", /vinculado a outros dados/],
      ["23502", /campo obrigatório/],
      ["42501", /não tem permissão/],
    ];
    for (const [code, esperado] of casos) {
      expect(() => assertOk({ data: null, error: { message: "cru", code } })).toThrow(esperado);
    }
  });

  it("usa o contexto da action quando o codigo nao tem texto proprio", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      assertOk({ data: null, error: { message: "erro interno", code: "XX999" } }, "Não foi possível salvar a turma"),
    ).toThrow("Não foi possível salvar a turma");
  });

  it("nao vaza a mensagem crua do Postgres para o usuario", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cru = 'duplicate key value violates unique constraint "turmas_pkey"';
    expect(() => assertOk({ data: null, error: { message: cru, code: "23505" } })).toThrow(/Já existe/);
    expect(() => assertOk({ data: null, error: { message: cru, code: "23505" } })).not.toThrow(cru);
  });
});
