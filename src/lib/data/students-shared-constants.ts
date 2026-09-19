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
