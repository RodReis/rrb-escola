import { describe, expect, it } from "vitest";
import { mediaAnual } from "./medias";

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
