import { describe, it, expect } from "vitest";
import { montarDRE, resultadoPorEvento, type LancamentoDRE } from "./dre";

function l(p: Partial<LancamentoDRE>): LancamentoDRE {
  return { tipo: "receita", categoria_id: "c1", categoria_nome: "Cat 1", valor: 100, status: "paga", ...p };
}

describe("DRE", () => {
  it("agrupa receitas e despesas por categoria e calcula resultado", () => {
    const r = montarDRE([
      l({ tipo: "receita", valor: 300 }),
      l({ tipo: "receita", valor: 200, categoria_id: "c2", categoria_nome: "Cat 2" }),
      l({ tipo: "despesa", valor: 120, categoria_id: "d1", categoria_nome: "Desp 1" })
    ]);
    expect(r.totalReceitas).toBe(500);
    expect(r.totalDespesas).toBe(120);
    expect(r.resultado).toBe(380);
    expect(r.receitas.length).toBe(2);
  });

  it("ignora cancelados", () => {
    const r = montarDRE([
      l({ tipo: "receita", valor: 100 }),
      l({ tipo: "receita", valor: 999, status: "cancelada" })
    ]);
    expect(r.totalReceitas).toBe(100);
  });

  it("categoria nula vira 'Sem categoria'", () => {
    const r = montarDRE([l({ categoria_id: null, categoria_nome: null, valor: 50 })]);
    expect(r.receitas[0].categoria_nome).toBe("Sem categoria");
  });

  it("resultado por evento (centro de custo)", () => {
    const evs = resultadoPorEvento([
      l({ tipo: "receita", valor: 500, evento_id: "e1", evento_nome: "Feira" }),
      l({ tipo: "despesa", valor: 200, evento_id: "e1", evento_nome: "Feira" }),
      l({ tipo: "receita", valor: 100 }) // sem evento -> fora
    ]);
    expect(evs.length).toBe(1);
    expect(evs[0].resultado).toBe(300);
  });
});
