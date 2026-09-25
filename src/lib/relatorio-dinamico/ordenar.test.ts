import { describe, it, expect } from "vitest";
import { chaveOrdenacao, ordenarLinhas, repetirCopias } from "./ordenar";
import type { DadosRelatorio } from "./tipos";

const dados: DadosRelatorio = {
  colunas: [
    { key: "nome", label: "Nome", grupo: "g", tipo: "texto" },
    { key: "nasc", label: "Nascimento", grupo: "g", tipo: "data" },
    { key: "sal", label: "Salário", grupo: "g", tipo: "numero" },
  ],
  linhas: [
    ["Érica", "10/03/2015", "R$ 1.000,00"],
    ["ana", "", "R$ 900,50"],
    ["Bruno", "01/12/2014", ""],
  ],
};

describe("ordenar", () => {
  it("chaveOrdenacao por tipo", () => {
    expect(chaveOrdenacao("10/03/2015", "data")).toBe("20150310");
    expect(chaveOrdenacao("R$ 1.234,56", "numero")).toBe(1234.56);
    expect(chaveOrdenacao("", "texto")).toBeNull();
  });
  it("texto pt-BR ignora acento e caixa", () => {
    const r = ordenarLinhas(dados, [{ key: "nome", dir: "asc" }]);
    expect(r.linhas.map((l) => l[0])).toEqual(["ana", "Bruno", "Érica"]);
  });
  it("data ordena cronologicamente e vazio vai para o fim em asc e desc", () => {
    expect(ordenarLinhas(dados, [{ key: "nasc", dir: "asc" }]).linhas.map((l) => l[0])).toEqual(["Bruno", "Érica", "ana"]);
    expect(ordenarLinhas(dados, [{ key: "nasc", dir: "desc" }]).linhas.map((l) => l[0])).toEqual(["Érica", "Bruno", "ana"]);
  });
  it("número ordena numericamente", () => {
    expect(ordenarLinhas(dados, [{ key: "sal", dir: "desc" }]).linhas.map((l) => l[0])).toEqual(["Érica", "ana", "Bruno"]);
  });
  it("multi-chave e estável", () => {
    const d: DadosRelatorio = {
      colunas: [{ key: "a", label: "A", grupo: "g", tipo: "texto" }, { key: "b", label: "B", grupo: "g", tipo: "texto" }],
      linhas: [["x", "2"], ["y", "1"], ["x", "1"]],
    };
    expect(ordenarLinhas(d, [{ key: "a", dir: "asc" }, { key: "b", dir: "asc" }]).linhas).toEqual([["x", "1"], ["x", "2"], ["y", "1"]]);
    expect(ordenarLinhas(d, []).linhas).toEqual(d.linhas);
  });
  it("repetirCopias repete em sequência", () => {
    expect(repetirCopias([["a"], ["b"]], 2)).toEqual([["a"], ["a"], ["b"], ["b"]]);
  });
});
