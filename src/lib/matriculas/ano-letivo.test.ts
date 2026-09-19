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

  // Trava C1: combo de nova matrícula (matriculas/page.tsx) precisa buscar
  // "sem matrícula" no MESMO ano que o formulário sugere — se page.tsx voltar
  // a usar o default de getAlunosSemMatriculaNoAno (getFullYear() puro), este
  // teste não pega a regressão sozinho, mas documenta a regra que os dois
  // lados (query e form) têm que respeitar.
  it("na janela de rematricula (setembro em diante) sugere o ano seguinte, nao o corrente", () => {
    expect(anoLetivoDaData(new Date(2026, 8, 19))).toBe(2027); // 19/09/2026, mesma data do fix
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
