import { describe, expect, it } from "vitest";
import { montarFiliacao } from "./filiacao";

describe("montarFiliacao", () => {
  it("imprime pai e mãe em caixa alta, nessa ordem", () => {
    expect(
      montarFiliacao([
        { nome: "Polyana Alves Bernardo Cabriny", parentesco: "Mãe" },
        { nome: "Daniel Flávio Cabriny de Almeida Costa", parentesco: "Pai" }
      ])
    ).toBe("DANIEL FLÁVIO CABRINY DE ALMEIDA COSTA e POLYANA ALVES BERNARDO CABRINY");
  });

  it("aceita 'mae' sem acento", () => {
    expect(montarFiliacao([{ nome: "Ana", parentesco: "mae" }])).toBe("ANA");
  });

  it("usa outros responsáveis quando não há pai nem mãe", () => {
    expect(
      montarFiliacao([{ nome: "Maria Avó", parentesco: "Avó" }])
    ).toBe("MARIA AVÓ");
  });

  it("ignora avó quando existe pai ou mãe", () => {
    expect(
      montarFiliacao([
        { nome: "Maria Avó", parentesco: "Avó" },
        { nome: "Joana Mãe", parentesco: "Mãe" }
      ])
    ).toBe("JOANA MÃE");
  });

  it("devolve null sem responsável cadastrado", () => {
    expect(montarFiliacao([])).toBeNull();
  });
});
