import { describe, it, expect } from "vitest";
import { layoutLogos, type CabecalhoDados } from "./cabecalho";
import { renderGrade } from "./grade";
import { renderTabular } from "./tabular";
import type { DadosRelatorio } from "../tipos";

const cab: CabecalhoDados = {
  titulo: "Festa do 3",
  subtitulo: "feste",
  empresaNome: "EPG TRINDADE",
  resolucao: "RESOLUÇÃO CEE/CEB Nº 518/2024",
  logos: [],
  emitidoEm: new Date(2026, 8, 25, 10, 7),
  descricao: "teste 222",
};

function dados(n: number): DadosRelatorio {
  return {
    colunas: ["Nome do Pai", "Nome da Mãe", "Nome Aluno", "Celulares"].map((l, i) => ({ key: `k${i}`, label: l, grupo: "g", tipo: "texto" as const })),
    linhas: Array.from({ length: n }, (_, i) => [`PAI ${i}`, `MÃE ${i}`, `ALUNO ${i}`, "(62)98481-8104 - FRANÇOISA - (Celular-MÃE) / (62)98416-7273 - MARGARETE".repeat(2)]),
  };
}

describe("layoutLogos", () => {
  it("0 logos → vazio", () => {
    expect(layoutLogos([], 18, 90, 3)).toEqual([]);
  });
  it("altura fixa, largura proporcional, gap entre logos", () => {
    const r = layoutLogos([{ w: 200, h: 100 }, { w: 100, h: 100 }], 18, 90, 3);
    expect(r).toEqual([{ x: 0, w: 36, h: 18 }, { x: 39, w: 18, h: 18 }]);
  });
  it("encolhe tudo quando passa da largura máxima", () => {
    const r = layoutLogos([{ w: 400, h: 100 }, { w: 400, h: 100 }, { w: 400, h: 100 }, { w: 400, h: 100 }], 18, 90, 3);
    const fim = r[r.length - 1].x + r[r.length - 1].w;
    expect(fim).toBeLessThanOrEqual(90.001);
  });
});

describe("grade e tabular", () => {
  it("grade: 12 registros quebram página sem erro e sem logos", () => {
    const doc = renderGrade(dados(12), cab);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
  it("tabular: paisagem e várias páginas com 60 linhas", () => {
    const doc = renderTabular(dados(60), cab);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
  it("sem empresa nenhuma ainda gera", () => {
    expect(() => renderTabular(dados(1), { ...cab, empresaNome: null, resolucao: null })).not.toThrow();
  });
});
