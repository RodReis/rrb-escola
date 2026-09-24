import { describe, it, expect } from "vitest";
import { derivarIconeAcao } from "./icone-acao";

describe("derivarIconeAcao", () => {
  it("aluno ativo com matricula ativa no ano -> cancelar", () => {
    expect(derivarIconeAcao(true, true)).toBe("cancelar");
  });

  it("aluno ativo sem matricula ativa no ano -> matricular", () => {
    expect(derivarIconeAcao(true, false)).toBe("matricular");
  });

  it("aluno inativo com matricula ativa no ano (estado inconsistente, mas nao deve crashar) -> matricular", () => {
    // Um aluno "inativo" nunca deveria ter matricula "ativa" simultaneamente
    // (a RPC de cancelamento sempre inativa o aluno ao cancelar a matricula),
    // mas a função não deve confiar nessa invariante silenciosamente — aluno
    // inativo sempre precisa do caminho de reativação (Matricular), mesmo que
    // o dado de matrícula esteja inconsistente por algum motivo externo.
    expect(derivarIconeAcao(false, true)).toBe("matricular");
  });

  it("aluno inativo sem matricula ativa no ano -> matricular", () => {
    expect(derivarIconeAcao(false, false)).toBe("matricular");
  });
});
