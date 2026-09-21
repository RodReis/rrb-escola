import { describe, expect, it } from "vitest";
import { agregarNotasConsolidadas, mediaAnual } from "./medias";

describe("mediaAnual", () => {
  it("calcula a média das bimestrais informadas", () => {
    expect(mediaAnual([10, 9, 8, 9])).toBe(9);
  });

  it("arredonda para uma casa decimal", () => {
    expect(mediaAnual([9.9, 9.8, 10, 9.9])).toBe(9.9);
  });

  it("ignora bimestres sem nota", () => {
    expect(mediaAnual([10, null, 8, null])).toBe(9);
  });

  it("devolve null quando não há nenhuma nota", () => {
    expect(mediaAnual([null, null, null, null])).toBeNull();
  });

  it("devolve null para lista vazia", () => {
    expect(mediaAnual([])).toBeNull();
  });
});

describe("agregarNotasConsolidadas", () => {
  it("agrupa bimestrais por disciplina e calcula a média anual de cada uma", () => {
    const linhas = [
      { disciplina_id: "mat", media: 8, disciplinas: { nome: "Matemática", ordem: 1 } },
      { disciplina_id: "mat", media: 10, disciplinas: { nome: "Matemática", ordem: 1 } },
      { disciplina_id: "port", media: 6, disciplinas: { nome: "Português", ordem: 0 } },
      { disciplina_id: "port", media: 8, disciplinas: { nome: "Português", ordem: 0 } }
    ];

    const resultado = agregarNotasConsolidadas(linhas);

    expect(resultado).toHaveLength(2);
    const matematica = resultado.find((n) => n.disciplinaId === "mat");
    const portugues = resultado.find((n) => n.disciplinaId === "port");
    expect(matematica?.nota).toBe(9);
    expect(portugues?.nota).toBe(7);
  });

  it("ordena o resultado pelo campo ordem da disciplina", () => {
    const linhas = [
      { disciplina_id: "hist", media: 7, disciplinas: { nome: "História", ordem: 3 } },
      { disciplina_id: "port", media: 8, disciplinas: { nome: "Português", ordem: 0 } },
      { disciplina_id: "mat", media: 9, disciplinas: { nome: "Matemática", ordem: 1 } }
    ];

    const resultado = agregarNotasConsolidadas(linhas);

    expect(resultado.map((n) => n.disciplinaNome)).toEqual(["Português", "Matemática", "História"]);
  });

  it("ignora bimestres sem nota lançada ao calcular a média", () => {
    const linhas = [
      { disciplina_id: "mat", media: 10, disciplinas: { nome: "Matemática", ordem: 0 } },
      { disciplina_id: "mat", media: null, disciplinas: { nome: "Matemática", ordem: 0 } },
      { disciplina_id: "mat", media: 8, disciplinas: { nome: "Matemática", ordem: 0 } }
    ];

    const resultado = agregarNotasConsolidadas(linhas);

    expect(resultado[0].nota).toBe(9);
  });

  it("devolve lista vazia quando não há linhas", () => {
    expect(agregarNotasConsolidadas([])).toEqual([]);
  });

  it("preenche cargaHoraria e faltas como null (não vêm de notas_consolidadas)", () => {
    const resultado = agregarNotasConsolidadas([
      { disciplina_id: "mat", media: 9, disciplinas: { nome: "Matemática", ordem: 0 } }
    ]);
    expect(resultado[0].cargaHoraria).toBeNull();
    expect(resultado[0].faltas).toBeNull();
  });
});
