export type IconeAcao = "matricular" | "cancelar";

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
