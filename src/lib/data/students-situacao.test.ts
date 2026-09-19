import { describe, expect, it } from "vitest";

/**
 * O filtro de situacao muda o tipo de join: ex-aluno nao tem matricula, e o
 * inner join usado pelos filtros de serie/turma/ano o excluiria sempre.
 * Este teste trava a regra de decisao, que e onde o bug moraria.
 */
function decidir(filtros: {
  situacao?: "ativos" | "inativos" | "todos";
  serieId?: string;
  turmaId?: string;
  segmento?: string;
  anoLetivo?: number;
}) {
  const situacao = filtros.situacao ?? "ativos";
  const querInativos = situacao !== "ativos";
  const hasEnrollmentFilter =
    !querInativos && Boolean(filtros.serieId || filtros.turmaId || filtros.segmento);
  return { situacao, hasEnrollmentFilter };
}

describe("filtro de situação na lista de alunos", () => {
  it("usa inner join só quando lista ativos", () => {
    expect(decidir({ serieId: "s1" }).hasEnrollmentFilter).toBe(true);
  });

  it("não usa inner join ao pedir ex-alunos, que não têm matrícula", () => {
    expect(decidir({ situacao: "inativos", serieId: "s1" }).hasEnrollmentFilter).toBe(false);
    expect(decidir({ situacao: "todos", serieId: "s1" }).hasEnrollmentFilter).toBe(false);
  });

  // A tela sempre manda um ano (o corrente por padrao). Se o ano sozinho
  // ligasse o inner join, o aluno ativo sem matricula no ano sumiria da lista
  // — e e justamente ele que a secretaria precisa achar para rematricular.
  it("ano letivo sozinho não esconde aluno sem matrícula no ano", () => {
    expect(decidir({ anoLetivo: 2026 }).hasEnrollmentFilter).toBe(false);
  });

  it("ano combinado com série volta a filtrar por matrícula", () => {
    expect(decidir({ anoLetivo: 2026, serieId: "s1" }).hasEnrollmentFilter).toBe(true);
  });

  it("padrão é ativos", () => {
    expect(decidir({}).situacao).toBe("ativos");
  });
});
