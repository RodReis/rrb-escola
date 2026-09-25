import { describe, it, expect } from "vitest";
import { emLotes } from "./lotes";

describe("emLotes", () => {
  it("divide em lotes de 150 por padrão", () => {
    const r = emLotes(Array.from({ length: 301 }, (_, i) => i));
    expect(r.map((l) => l.length)).toEqual([150, 150, 1]);
  });
  it("lista vazia → nenhum lote", () => {
    expect(emLotes([])).toEqual([]);
  });
});
