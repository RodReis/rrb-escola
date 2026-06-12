import { describe, expect, it } from "vitest";
import { calcHoraAula, calcDsrSobre, calcHoraAtividade } from "./proventos";

describe("proventos professor", () => {
  it("hora-aula: valor x aulas x semanas_mes", () => {
    expect(calcHoraAula(10, 20, 4.5)).toBe(900);
  });
  it("DSR oficial: salario-aulas / 6 (contracheque mai/2026)", () => {
    expect(calcDsrSobre(5002.56, 6)).toBe(833.76);
  });
  it("DSR sobre verba de dobra-como-rubrica (mecanismo valor_contratual)", () => {
    expect(calcDsrSobre(2457.51, 6)).toBe(409.59);
  });
  it("hora-atividade: percentual sobre base+DSR", () => {
    expect(calcHoraAtividade(2917.81, 5)).toBe(145.89);
  });
});
