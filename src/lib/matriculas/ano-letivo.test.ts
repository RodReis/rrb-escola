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

  it("a referência é o piso: nunca deixa o ano letivo regredir abaixo dela", () => {
    // data de 2025 mas ano de referência já avançado para 2030: resultado
    // nunca fica abaixo da referência, mesmo fora da janela de corte.
    expect(anoLetivoDaData(new Date(2025, 0, 10), 2030)).toBe(2030);
    // Dentro da janela de corte (setembro), o corte soma 1 ao ano da DATA
    // (2026), não ao da referência — a referência só age como piso, então o
    // maior dos dois (2030) prevalece, sem empilhar os dois +1.
    expect(anoLetivoDaData(new Date(2025, 8, 1), 2030)).toBe(2030);
  });

  it("não soma +1 duas vezes quando a referência já foi avançada ANTES do corte de setembro bater no relógio (bug C1 da revisão)", () => {
    // Secretaria avança a referência em dezembro/2026 (fluxo que a própria
    // tela recomenda: "geralmente após fechamento das notas finais do ano"),
    // de 2026 para 2027. A matrícula feita fisicamente em dezembro/2026
    // (regra: set-dez vale para o ano seguinte) deve valer para 2027 — a
    // referência JÁ é 2027, não pode levar o corte a somar +1 de novo e
    // pular para 2028.
    expect(anoLetivoDaData(new Date(2026, 11, 10), 2027)).toBe(2027);
  });

  it("corte de setembro soma 1 ao ano da data quando a referência está atrasada em relação ao relógio", () => {
    // Secretaria esqueceu de avançar: referência ainda em 2026, mas a data
    // real já é setembro/2027 — matrícula de setembro vale para o ano
    // seguinte ao da DATA real (2028), não trava no 2026 da referência
    // desatualizada.
    expect(anoLetivoDaData(new Date(2027, 8, 1), 2026)).toBe(2028);
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
