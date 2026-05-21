import { describe, it, expect } from "vitest";
import { normalizarTelefone } from "./telefone";

describe("normalizarTelefone", () => {
  it("celular 11 dígitos (DDD+9+8) prefixa 55", () => {
    expect(normalizarTelefone("62999998888")).toBe("5562999998888");
  });

  it("número já com 55 (13 dígitos) é mantido", () => {
    expect(normalizarTelefone("5562999998888")).toBe("5562999998888");
  });

  it("fixo 10 dígitos (DDD+8) prefixa 55", () => {
    expect(normalizarTelefone("6233334444")).toBe("556233334444");
  });

  it("número com 55 e 12 dígitos (fixo) é mantido", () => {
    expect(normalizarTelefone("556233334444")).toBe("556233334444");
  });

  it("string com máscara é normalizada", () => {
    expect(normalizarTelefone("(62) 99999-8888")).toBe("5562999998888");
  });

  it("string com +55 e máscara é normalizada", () => {
    expect(normalizarTelefone("+55 (62) 99999-8888")).toBe("5562999998888");
  });

  it("número curto demais retorna null", () => {
    expect(normalizarTelefone("99998888")).toBeNull();
  });

  it("string vazia retorna null", () => {
    expect(normalizarTelefone("")).toBeNull();
  });

  it("string sem dígitos retorna null", () => {
    expect(normalizarTelefone("abc-def")).toBeNull();
  });

  it("número longo demais retorna null", () => {
    expect(normalizarTelefone("5562999998888000")).toBeNull();
  });
});
