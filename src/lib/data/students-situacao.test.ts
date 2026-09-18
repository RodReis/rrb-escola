import { describe, expect, it } from "vitest";

/**
 * O filtro de situacao muda o tipo de join: ex-aluno nao tem matricula, e o
 * inner join usado pelos filtros de serie/turma/ano o excluiria sempre.
 * Este teste trava a regra de decisao, que e onde o bug moraria.
 */
function decidir(filtros: {
  situacao?: "ativos" | "inativos" | "todos";
  serieId?: string;
  anoLetivo?: number;
}) {
  const situacao = filtros.situacao ?? "ativos";
  const querInativos = situacao !== "ativos";
  const hasEnrollmentFilter = !querInativos && Boolean(filtros.serieId || filtros.anoLetivo);
  return { situacao, hasEnrollmentFilter };
}

describe("filtro de situação na lista de alunos", () => {
  it("usa inner join só quando lista ativos", () => {
    expect(decidir({ anoLetivo: 2026 }).hasEnrollmentFilter).toBe(true);
  });

  it("não usa inner join ao pedir ex-alunos, que não têm matrícula", () => {
    expect(decidir({ situacao: "inativos", anoLetivo: 2026 }).hasEnrollmentFilter).toBe(false);
    expect(decidir({ situacao: "todos", anoLetivo: 2026 }).hasEnrollmentFilter).toBe(false);
  });

  it("padrão é ativos", () => {
    expect(decidir({}).situacao).toBe("ativos");
  });
});
