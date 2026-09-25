export type IconeAcao = "matricular" | "cancelar";

type MatriculaAnoRef = { status?: string | null; ano_letivo?: number | null } | null | undefined;

/**
 * Confere se a matrícula resolvida por `activeEnrollment` (que tem fallback
 * para qualquer matrícula ativa de QUALQUER ano quando nenhuma bate o ano
 * filtrado — bom para exibição de série/turma, errado para decidir a ação)
 * é de fato do ano filtrado e está ativa. Sem essa checagem, um aluno cuja
 * única matrícula ativa é de um ano anterior aparece com o ícone Cancelar
 * (e abre o diálogo) sobre a matrícula errada.
 */
export function matriculaEhDoAnoFiltrado(enrollment: MatriculaAnoRef, anoLetivo: number): boolean {
  return enrollment?.status === "ativa" && enrollment?.ano_letivo === anoLetivo;
}

/**
 * Decide qual ícone de ação de negócio mostrar na lista de alunos:
 * "cancelar" só quando o aluno está ativo E tem matrícula ativa no ano
 * corrente; "matricular" em qualquer outro caso (inativo, ou ativo mas sem
 * matrícula no ano — este último é o aluno que a secretaria precisa achar
 * para rematricular).
 *
 * Aluno inativo sempre cai em "matricular", mesmo que o dado de matrícula
 * pareça mostrar uma "ativa" simultânea (estado que não deveria existir,
 * já que cancelar_matricula sempre inativa o aluno junto) — o ícone de
 * reativação é sempre seguro de mostrar; o de cancelamento sobre um aluno já
 * inativo não faria sentido nenhum.
 */
export function derivarIconeAcao(alunoAtivo: boolean, matriculaAtivaNoAno: boolean): IconeAcao {
  if (!alunoAtivo) return "matricular";
  return matriculaAtivaNoAno ? "cancelar" : "matricular";
}
