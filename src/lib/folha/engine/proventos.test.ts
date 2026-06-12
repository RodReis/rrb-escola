import { describe, expect, it } from "vitest";
import { calcHoraAula, calcDsrSobre, calcHoraAtividade } from "./proventos";

describe("proventos professor", () => {
  it("hora-aula: valor x aulas x semanas_mes", () => {
    expect(calcHoraAula(10, 20, 4.5)).toBe(900);
  });
  it("DSR com divisor 6 = 1/5 do valor sem DSR (Ana Flávia: base)", () => {
    expect(calcDsrSobre(2431.51, 6)).toBe(486.3);
  });
  it("DSR da dobra (Ana Flávia: valor calculado, pendente confirmacao 460,95 vs 491,50)", () => {
    expect(calcDsrSobre(2457.51, 6)).toBe(491.5);
  });
  it("hora-atividade: percentual sobre base+DSR", () => {
    expect(calcHoraAtividade(2917.81, 5)).toBe(145.89);
  });
});
