import { describe, it, expect } from "vitest";
import { derivarIconeAcao, matriculaEhDoAnoFiltrado } from "./icone-acao";

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

describe("matriculaEhDoAnoFiltrado", () => {
  // I1: activeEnrollment(enrollments, anoLetivo) tem fallback — se nenhuma
  // matricula bate o ano filtrado, devolve QUALQUER matricula ativa do array
  // inteiro (de qualquer ano). Bom pra exibicao, errado pra decidir a acao.
  it("aluno com matricula ativa so em 2025, filtro em 2026 -> false (nao mostra Cancelar)", () => {
    const enrollmentDe2025 = { status: "ativa", ano_letivo: 2025 };
    expect(matriculaEhDoAnoFiltrado(enrollmentDe2025, 2026)).toBe(false);
  });

  it("aluno com matricula ativa no ano filtrado -> true", () => {
    const enrollmentDoAno = { status: "ativa", ano_letivo: 2026 };
    expect(matriculaEhDoAnoFiltrado(enrollmentDoAno, 2026)).toBe(true);
  });

  it("matricula do ano certo mas status concluida -> false", () => {
    const enrollmentConcluida = { status: "concluida", ano_letivo: 2026 };
    expect(matriculaEhDoAnoFiltrado(enrollmentConcluida, 2026)).toBe(false);
  });

  it("sem matricula (null) -> false", () => {
    expect(matriculaEhDoAnoFiltrado(null, 2026)).toBe(false);
  });
});
