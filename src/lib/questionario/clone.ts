export type QuestionarioOrigem = { descricao: string; observacoes: string | null };
export type VinculoOrigem = { questao_id: string; escala_id: string | null; ordem: number };

/** Clone nasce inativo, com " (cópia)", questões/escalas/ordem preservadas (renumeradas 1..n). */
export function montarClone(origem: QuestionarioOrigem, vinculos: VinculoOrigem[]) {
  const ordenados = [...vinculos].sort((a, b) => a.ordem - b.ordem);
  return {
    questionario: { descricao: `${origem.descricao} (cópia)`, observacoes: origem.observacoes, ativo: false },
    vinculos: ordenados.map((v, i) => ({ questao_id: v.questao_id, escala_id: v.escala_id, ordem: i + 1 })),
  };
}
