import { describe, expect, it } from "vitest";
import { anoLetivoDaData, anoLetivoSugerido } from "./ano-letivo";

describe("anoLetivoDaData", () => {
  it("matricula de setembro em diante vale para o ano seguinte ao de referência", () => {
    expect(anoLetivoDaData(new Date(2025, 8, 1), 2025)).toBe(2026);   // 01/09
    expect(anoLetivoDaData(new Date(2025, 10, 4), 2025)).toBe(2026);  // 04/11
    expect(anoLetivoDaData(new Date(2025, 11, 20), 2025)).toBe(2026); // 20/12
  });

  it("matricula antes de setembro vale para o ano de referência", () => {
    expect(anoLetivoDaData(new Date(2025, 0, 10), 2025)).toBe(2025);  // 10/01
    expect(anoLetivoDaData(new Date(2025, 7, 31), 2025)).toBe(2025);  // 31/08
  });

  // Trava C1: combo de nova matrícula (matriculas/page.tsx) precisa buscar
  // "sem matrícula" no MESMO ano que o formulário sugere — se page.tsx voltar
  // a usar o default de getAlunosSemMatriculaNoAno (getFullYear() puro), este
  // teste não pega a regressão sozinho, mas documenta a regra que os dois
  // lados (query e form) têm que respeitar.
  it("na janela de rematricula (setembro em diante) sugere o ano seguinte ao de referência, nao o corrente", () => {
    expect(anoLetivoDaData(new Date(2026, 8, 19), 2026)).toBe(2027); // 19/09/2026, mesma data do fix
  });

  it("a base é o ano de referência, não o ano do relógio da chamada", () => {
    // data de 2025 mas ano de referência já avançado para 2030: resultado segue a config
    expect(anoLetivoDaData(new Date(2025, 0, 10), 2030)).toBe(2030);
    expect(anoLetivoDaData(new Date(2025, 8, 1), 2030)).toBe(2031);
  });
});

describe("anoLetivoSugerido", () => {
  it("sugere o ano do corte quando esta livre", () => {
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [], 2025)).toBe(2026);
  });

  it("avanca enquanto o ano estiver ocupado", () => {
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [2026], 2025)).toBe(2027);
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [2026, 2027], 2025)).toBe(2028);
  });

  it("ignora anos ocupados anteriores ao do corte", () => {
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [2023, 2024, 2025], 2025)).toBe(2026);
  });
});
