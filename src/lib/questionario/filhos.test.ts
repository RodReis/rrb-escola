import { beforeEach, describe, expect, it, vi } from "vitest";
import { substituirFilhos } from "./filhos";
import { fakeSupabase } from "./test-support";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("substituirFilhos", () => {
  it("grava os novos ANTES de apagar os antigos", async () => {
    const db = fakeSupabase({ "escala_opcoes.select": [{ data: [{ id: "o1" }, { id: "o2" }] }] });
    await substituirFilhos(db.client as never, "escala_opcoes", "e1", ["A", "B"]);

    expect(db.calls.map((c) => c.op)).toEqual(["select", "insert", "delete"]);
    expect(db.chamadas("escala_opcoes", "insert")[0].payload).toEqual([
      { escala_id: "e1", rotulo: "A", ordem: 1 },
      { escala_id: "e1", rotulo: "B", ordem: 2 },
    ]);
    expect(db.chamadas("escala_opcoes", "delete")[0].filtros).toContainEqual(["in", "id", ["o1", "o2"]]);
  });

  it("se o insert falha, não apaga os antigos e propaga o erro", async () => {
    const db = fakeSupabase({
      "questao_alternativas.select": [{ data: [{ id: "a1" }] }],
      "questao_alternativas.insert": [{ error: { message: "boom" } }],
    });
    await expect(
      substituirFilhos(db.client as never, "questao_alternativas", "q1", ["X", "Y"]),
    ).rejects.toThrow();
    expect(db.chamadas("questao_alternativas", "delete")).toHaveLength(0);
  });

  it("lista vazia só limpa os antigos", async () => {
    const db = fakeSupabase({ "questao_alternativas.select": [{ data: [{ id: "a1" }] }] });
    await substituirFilhos(db.client as never, "questao_alternativas", "q1", []);
    expect(db.chamadas("questao_alternativas", "insert")).toHaveLength(0);
    expect(db.chamadas("questao_alternativas", "delete")).toHaveLength(1);
  });
});
