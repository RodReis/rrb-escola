import { normalizeNome } from "@/lib/format/normalize-nome";

export type FiltroAlunosAtivosResolvido = {
  anoLetivo: number;
  serieId?: string;
  turmaId?: string;
  nomeNormalizado?: string;
};

/**
 * Resolve o filtro de entrada da fonte unica de alunos ativos: aplica o
 * default de ano corrente e normaliza o termo de busca por nome (sem
 * acento/caixa), para comparar contra `alunos.nome_normalizado`.
 */
export function montarFiltroAlunosAtivos(filtro: {
  anoLetivo?: number;
  serieId?: string;
  turmaId?: string;
  nome?: string;
}): FiltroAlunosAtivosResolvido {
  return {
    anoLetivo: filtro.anoLetivo ?? new Date().getFullYear(),
    serieId: filtro.serieId,
    turmaId: filtro.turmaId,
    nomeNormalizado: filtro.nome ? normalizeNome(filtro.nome) : undefined,
  };
}

/**
 * true quando o aluno NAO tem matricula `ativa` no ano informado — universo
 * do combo de nova matricula/rematricula (quem ainda pode ser matriculado
 * nesse ano). Contexto oposto ao de `getAlunosAtivosAnoCorrente`.
 */
export function alunoSemMatriculaAtivaNoAno(
  matriculas: { ano_letivo: number; status: string }[],
  anoLetivo: number
): boolean {
  return !matriculas.some((m) => m.ano_letivo === anoLetivo && m.status === "ativa");
}
