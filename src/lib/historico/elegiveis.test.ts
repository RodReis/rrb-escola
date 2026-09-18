import { describe, expect, it } from "vitest";
import { separarElegiveis } from "./elegiveis";

describe("separarElegiveis", () => {
  it("separa quem tem histórico de quem não tem", () => {
    const { prontos, pendentes } = separarElegiveis([
      { id: "1", nome: "ANA", temHistorico: true },
      { id: "2", nome: "BRUNO", temHistorico: false },
      { id: "3", nome: "CARLA", temHistorico: true }
    ]);

    expect(prontos.map((a) => a.nome)).toEqual(["ANA", "CARLA"]);
    expect(pendentes.map((a) => a.nome)).toEqual(["BRUNO"]);
  });

  it("devolve listas vazias para entrada vazia", () => {
    expect(separarElegiveis([])).toEqual({ prontos: [], pendentes: [] });
  });

  it("devolve todos como pendentes quando ninguém tem histórico", () => {
    const { prontos, pendentes } = separarElegiveis([{ id: "1", nome: "ANA", temHistorico: false }]);
    expect(prontos).toEqual([]);
    expect(pendentes).toHaveLength(1);
  });
});
