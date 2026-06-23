import { describe, it, expect } from "vitest";
import { mapAtividades } from "./pipeline-atividade-helpers";

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "1",
    tipo: "nota",
    descricao: "Ligou para o responsável",
    created_at: "2026-06-20T10:00:00Z",
    usuario: { nome: "Maria" },
    card: { titulo: "João Silva" },
    ...over,
  };
}

describe("mapAtividades", () => {
  it("mapeia linha crua para AtividadeRecente", () => {
    const [a] = mapAtividades([row()]);
    expect(a).toEqual({
      id: "1",
      tipo: "nota",
      descricao: "Ligou para o responsável",
      createdAt: "2026-06-20T10:00:00Z",
      autorNome: "Maria",
      cardTitulo: "João Silva",
    });
  });

  it("normaliza embed vindo como array (cardinalidade)", () => {
    const [a] = mapAtividades([
      row({ usuario: [{ nome: "Ana" }], card: [{ titulo: "Pedro" }] }),
    ]);
    expect(a.autorNome).toBe("Ana");
    expect(a.cardTitulo).toBe("Pedro");
  });

  it("usa null quando autor/título ausentes e '' quando descrição nula", () => {
    const [a] = mapAtividades([
      row({ usuario: null, card: null, descricao: null }),
    ]);
    expect(a.autorNome).toBeNull();
    expect(a.cardTitulo).toBeNull();
    expect(a.descricao).toBe("");
  });

  it("ordena por created_at desc", () => {
    const out = mapAtividades([
      row({ id: "a", created_at: "2026-06-18T00:00:00Z" }),
      row({ id: "b", created_at: "2026-06-22T00:00:00Z" }),
      row({ id: "c", created_at: "2026-06-20T00:00:00Z" }),
    ]);
    expect(out.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("limita ao número pedido", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({ id: String(i), created_at: `2026-06-${10 + i}T00:00:00Z` }),
    );
    expect(mapAtividades(rows, 5)).toHaveLength(5);
  });

  it("retorna vazio para lista vazia", () => {
    expect(mapAtividades([])).toEqual([]);
  });
});
