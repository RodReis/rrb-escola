import { describe, expect, it } from "vitest";
import { montarGrade, normalizarDisciplina } from "./grade";
import type { HistoricoAno } from "./tipos";

function ano(over: Partial<HistoricoAno> & Pick<HistoricoAno, "serieNome" | "notas">): HistoricoAno {
  return {
    id: over.serieNome,
    ano: 2024,
    serieId: null,
    origem: "externa",
    instituicao: null,
    cidade: null,
    uf: null,
    resultado: "aprovado",
    mediaAprovacao: null,
    cargaHoraria: null,
    diasLetivos: null,
    faltas: null,
    percentualFrequencia: null,
    congelado: true,
    ...over
  };
}

function nota(disciplinaNome: string, valor: number | null, ch: number | null = null) {
  return { disciplinaId: null, disciplinaNome, nota: valor, cargaHoraria: ch, faltas: null, ordem: 0 };
}

describe("normalizarDisciplina", () => {
  it("ignora acento e caixa", () => {
    expect(normalizarDisciplina("Matemática")).toBe(normalizarDisciplina("MATEMATICA"));
  });

  it("ignora espaços nas bordas e espaços repetidos", () => {
    expect(normalizarDisciplina("  LÍNGUA   PORTUGUESA ")).toBe(normalizarDisciplina("LINGUA PORTUGUESA"));
  });
});

describe("montarGrade", () => {
  it("colapsa a mesma disciplina escrita de formas diferentes numa linha só", () => {
    const anos = [
      ano({ serieNome: "1º ANO", notas: [nota("MATEMÁTICA", 9.9)] }),
      ano({ serieNome: "2º ANO", notas: [nota("Matematica", 10)] })
    ];

    const grade = montarGrade(anos, ["1º ANO", "2º ANO"]);

    expect(grade).toHaveLength(1);
    expect(grade[0].celulas.map((c) => c.nota)).toEqual([9.9, 10]);
  });

  it("usa a grafia do primeiro ano em que a disciplina aparece", () => {
    const anos = [
      ano({ serieNome: "1º ANO", notas: [nota("MATEMÁTICA", 9.9)] }),
      ano({ serieNome: "2º ANO", notas: [nota("Matematica", 10)] })
    ];

    expect(montarGrade(anos, ["1º ANO", "2º ANO"])[0].disciplina).toBe("MATEMÁTICA");
  });

  it("deixa célula nula na série em que a disciplina não existe", () => {
    const anos = [
      ano({ serieNome: "1º ANO", notas: [nota("CIÊNCIAS", 9.9)] }),
      ano({ serieNome: "2º ANO", notas: [nota("LEITURA", 10)] })
    ];

    const grade = montarGrade(anos, ["1º ANO", "2º ANO"]);

    expect(grade.map((l) => l.disciplina)).toEqual(["CIÊNCIAS", "LEITURA"]);
    expect(grade[0].celulas[1].nota).toBeNull();
    expect(grade[1].celulas[0].nota).toBeNull();
  });

  it("gera uma célula por coluna pedida, mesmo sem ano cursado", () => {
    const anos = [ano({ serieNome: "1º ANO", notas: [nota("ARTE", 10)] })];

    const grade = montarGrade(anos, ["1º ANO", "2º ANO", "3º ANO"]);

    expect(grade[0].celulas).toHaveLength(3);
    expect(grade[0].celulas[2].nota).toBeNull();
  });

  it("soma a carga horária das séries cursadas em chTotal", () => {
    const anos = [
      ano({ serieNome: "6º ANO", notas: [nota("ARTE", 10, 40)] }),
      ano({ serieNome: "7º ANO", notas: [nota("ARTE", 9, 60)] })
    ];

    expect(montarGrade(anos, ["6º ANO", "7º ANO"])[0].chTotal).toBe(100);
  });

  it("deixa chTotal nulo quando nenhuma série informa carga horária", () => {
    const anos = [ano({ serieNome: "1º ANO", notas: [nota("ARTE", 10)] })];

    expect(montarGrade(anos, ["1º ANO"])[0].chTotal).toBeNull();
  });

  it("preserva a ordem de aparição das disciplinas entre anos", () => {
    const anos = [
      ano({ serieNome: "1º ANO", notas: [nota("CIÊNCIAS", 9), nota("ARTE", 8)] }),
      ano({ serieNome: "2º ANO", notas: [nota("ARTE", 10), nota("HISTÓRIA", 7)] })
    ];

    expect(montarGrade(anos, ["1º ANO", "2º ANO"]).map((l) => l.disciplina)).toEqual([
      "CIÊNCIAS",
      "ARTE",
      "HISTÓRIA"
    ]);
  });
});
