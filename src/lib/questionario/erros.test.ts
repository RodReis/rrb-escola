import { describe, expect, it } from "vitest";
import { duplicado } from "./erros";

describe("duplicado", () => {
  it("23505 vira resultado { ok: false } (não exceção)", () => {
    const r = duplicado({ error: { code: "23505", message: "dup" } }, "Já existe.");
    expect(r).toEqual({ ok: false, error: "Já existe." });
  });
  it("outros erros e sucesso devolvem null (seguem para assertOk)", () => {
    expect(duplicado({ error: { code: "23503", message: "fk" } }, "x")).toBeNull();
    expect(duplicado({ error: { message: "sem codigo" } }, "x")).toBeNull();
    expect(duplicado({ error: null }, "x")).toBeNull();
  });
});
