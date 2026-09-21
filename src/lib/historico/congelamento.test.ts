import { describe, expect, it } from "vitest";
import { deveCongelar } from "./congelamento";

describe("deveCongelar", () => {
  it("congela ano interno com resultado final", () => {
    expect(deveCongelar("aprovado", "interna")).toBe(true);
    expect(deveCongelar("reprovado", "interna")).toBe(true);
    expect(deveCongelar("transferido", "interna")).toBe(true);
  });

  it("não congela ano interno ainda em curso", () => {
    expect(deveCongelar("cursando", "interna")).toBe(false);
  });

  it("congela ano externo sempre, inclusive 'cursando'", () => {
    expect(deveCongelar("cursando", "externa")).toBe(true);
    expect(deveCongelar("aprovado", "externa")).toBe(true);
  });
});
