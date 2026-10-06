import { describe, expect, it } from "vitest";
import { montarClone } from "./clone";

describe("montarClone", () => {
  it("nasce inativo, com sufixo, copiando questões, escala e ordem", () => {
    const r = montarClone(
      { descricao: "Quadro Infantil 3", observacoes: "obs" },
      [
        { questao_id: "b", escala_id: null, ordem: 5 },
        { questao_id: "a", escala_id: "e1", ordem: 2 },
      ],
    );
    expect(r.questionario).toEqual({ descricao: "Quadro Infantil 3 (cópia)", observacoes: "obs", ativo: false });
    expect(r.vinculos).toEqual([
      { questao_id: "a", escala_id: "e1", ordem: 1 },
      { questao_id: "b", escala_id: null, ordem: 2 },
    ]);
  });
  it("clone de questionário vazio não tem vínculos", () => {
    const r = montarClone({ descricao: "Vazio", observacoes: null }, []);
    expect(r.vinculos).toEqual([]);
    expect(r.questionario.ativo).toBe(false);
  });
});
