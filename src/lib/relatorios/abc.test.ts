import { describe, it, expect } from "vitest";
import { curvaABC, type GiroVariacao } from "./abc";

function g(id: string, qtd: number): GiroVariacao {
  return { variacao_id: id, rotulo: id, quantidadeSaida: qtd };
}

describe("curva ABC", () => {
  it("classifica por giro acumulado (A top 80%)", () => {
    const r = curvaABC([g("a", 80), g("b", 15), g("c", 5)]);
    const byId = Object.fromEntries(r.map((x) => [x.variacao_id, x.classe]));
    expect(byId.a).toBe("A");
    expect(byId.b).toBe("B");
    expect(byId.c).toBe("C");
  });

  it("ordena do maior giro para o menor", () => {
    const r = curvaABC([g("x", 10), g("y", 90)]);
    expect(r[0].variacao_id).toBe("y");
  });

  it("total zero -> tudo classe C, sem divisão por zero", () => {
    const r = curvaABC([g("a", 0), g("b", 0)]);
    expect(r.every((x) => x.classe === "C")).toBe(true);
    expect(r[0].percentual).toBe(0);
  });

  it("percentual acumulado chega a 100", () => {
    const r = curvaABC([g("a", 50), g("b", 50)]);
    expect(Math.round(r[r.length - 1].acumulado)).toBe(100);
  });
});
