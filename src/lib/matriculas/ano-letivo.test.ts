import { describe, expect, it } from "vitest";
import { anoLetivoDaData, anoLetivoSugerido } from "./ano-letivo";

describe("anoLetivoDaData", () => {
  it("matricula de setembro em diante vale para o ano seguinte", () => {
    expect(anoLetivoDaData(new Date(2025, 8, 1))).toBe(2026);   // 01/09
    expect(anoLetivoDaData(new Date(2025, 10, 4))).toBe(2026);  // 04/11
    expect(anoLetivoDaData(new Date(2025, 11, 20))).toBe(2026); // 20/12
  });

  it("matricula antes de setembro vale para o ano corrente", () => {
    expect(anoLetivoDaData(new Date(2025, 0, 10))).toBe(2025);  // 10/01
    expect(anoLetivoDaData(new Date(2025, 7, 31))).toBe(2025);  // 31/08
  });
});

describe("anoLetivoSugerido", () => {
  it("sugere o ano do corte quando esta livre", () => {
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [])).toBe(2026);
  });

  it("avanca enquanto o ano estiver ocupado", () => {
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [2026])).toBe(2027);
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [2026, 2027])).toBe(2028);
  });

  it("ignora anos ocupados anteriores ao do corte", () => {
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [2023, 2024, 2025])).toBe(2026);
  });
});
