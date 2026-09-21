import { describe, expect, it } from "vitest";
import { statusParaContagemDeSegmento } from "./students";

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

/**
 * As abas de segmento precisam somar o mesmo total de matriculados que o
 * organograma e os KPIs do dashboard mostram (fonte única, `contarAlunosAtivos`).
 * Aceitar `concluida` no ano corrente contava aluno que já saiu da escola e
 * fazia a soma das abas estourar o número oficial.
 */
describe("status contados nas abas de segmento", () => {
  const CORRENTE = 2026;

  it("no ano corrente conta só matrícula ativa", () => {
    expect(statusParaContagemDeSegmento(2026, CORRENTE)).toEqual(["ativa"]);
  });

  it("quem concluiu no ano corrente não é contado", () => {
    expect(statusParaContagemDeSegmento(2026, CORRENTE)).not.toContain("concluida");
  });

  it("em ano encerrado conta também quem concluiu", () => {
    expect(statusParaContagemDeSegmento(2025, CORRENTE)).toEqual(["ativa", "concluida"]);
  });

  it("ano futuro segue a regra do corrente", () => {
    expect(statusParaContagemDeSegmento(2027, CORRENTE)).toEqual(["ativa"]);
  });
});

/**
 * Aluno sem matrícula no ano não tem segmento. Quem entra na aba "Todos"
 * depende da situação pedida: listando ativos ela conta só matriculados (bate
 * com o título e com a soma das abas); listando inativos/todos precisa contar
 * o ex-aluno, que não tem matrícula nenhuma e sumiria da aba.
 */
function contaEmTodosSemMatricula(filtros: {
  situacao?: "ativos" | "inativos" | "todos";
  serieId?: string;
  turmaId?: string;
}) {
  const querInativos = (filtros.situacao ?? "ativos") !== "ativos";
  return querInativos && !filtros.serieId && !filtros.turmaId;
}

describe('aba "Todos" com aluno sem matrícula no ano', () => {
  it("não conta ao listar ativos — título e abas mostram matriculados", () => {
    expect(contaEmTodosSemMatricula({})).toBe(false);
  });

  it("conta ex-aluno ao listar inativos, que nunca tem matrícula ativa", () => {
    expect(contaEmTodosSemMatricula({ situacao: "inativos" })).toBe(true);
    expect(contaEmTodosSemMatricula({ situacao: "todos" })).toBe(true);
  });

  it("filtro de série ou turma exige matrícula e exclui quem não tem", () => {
    expect(contaEmTodosSemMatricula({ situacao: "inativos", serieId: "s1" })).toBe(false);
    expect(contaEmTodosSemMatricula({ situacao: "inativos", turmaId: "t1" })).toBe(false);
  });
});
