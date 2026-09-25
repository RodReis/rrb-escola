import { describe, it, expect } from "vitest";
import { montarDados } from "./montar";
import { relacoesNecessarias } from "./catalogo";
import type { ColunaDef } from "./tipos";

type Ctx = { n: string; d: string };
const cat: ColunaDef<Ctx>[] = [
  { key: "n", label: "Nome", grupo: "g", relacoes: [], resolve: (c) => c.n },
  { key: "d", label: "Data", grupo: "g", relacoes: ["x"], tipo: "data", resolve: (c) => c.d },
];

describe("montarDados", () => {
  it("respeita a ordem das keys pedidas", () => {
    expect(montarDados(cat, [{ n: "A", d: "01/01/2020" }], ["d", "n"])).toEqual({
      colunas: [{ key: "d", label: "Data", grupo: "g", tipo: "data" }, { key: "n", label: "Nome", grupo: "g", tipo: "texto" }],
      linhas: [["01/01/2020", "A"]],
    });
  });
  it("coluna desconhecida lança", () => {
    expect(() => montarDados(cat, [], ["zzz"])).toThrow("Coluna desconhecida: zzz");
  });
  it("relacoesNecessarias une as relações das keys", () => {
    expect(Array.from(relacoesNecessarias(cat, ["n", "d"]))).toEqual(["x"]);
  });
});
