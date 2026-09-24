import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { montarFiliacao } from "@/lib/historico/filiacao";
import { getCredenciamentoVigente } from "@/lib/data/historico";
import type { DadosDeclaracao } from "@/lib/documents/declaracao-resolver";
import { createServerClient } from "@/lib/supabase/server";

export type AlunoParaDeclaracao = { matriculaId: string; alunoId: string; nome: string };

export type FiltroEmissao = {
  anoLetivo: number;
  serieId?: string;
  turmaId?: string;
  alunoId?: string;
};

/**
 * Entram ativa, cancelada e transferida do ano — diferente da elegibilidade
 * do histórico (só ativa/concluida), porque a declaração de transferência é
 * emitida exatamente para quem já saiu da escola.
 */
export async function listarAlunosParaDeclaracao(filtro: FiltroEmissao): Promise<AlunoParaDeclaracao[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("matriculas")
    .select("id, aluno_id, alunos(nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", filtro.anoLetivo);

  if (filtro.serieId) query = query.eq("serie_id", filtro.serieId);
  if (filtro.turmaId) query = query.eq("turma_id", filtro.turmaId);
  if (filtro.alunoId) query = query.eq("aluno_id", filtro.alunoId);

  const { data, error } = await query.in("status", ["ativa", "cancelada", "transferida"]);
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const aluno = row.alunos as { nome?: string } | null;
      if (!aluno?.nome) return null;
      return { matriculaId: row.id as string, alunoId: row.aluno_id as string, nome: aluno.nome };
    })
    .filter((a): a is AlunoParaDeclaracao => a !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Monta os dados de uma matrícula para resolverDeclaracao(). Uma matrícula
 * com dado faltante (ex.: sem filiação) resolve os campos para null/vazio —
 * nunca lança, para não interromper a emissão do lote inteiro (ver Task 8).
 *
 * Filiação vem de `responsaveis_aluno` (nome, parentesco) — mesma tabela e
 * shape usados por getHistoricoAluno em src/lib/data/historico.ts, que
 * consulta em separado por aluno_id. Aqui usamos o nested select do Supabase
 * (alunos -> responsaveis_aluno) para trazer tudo em uma única query.
 */
export async function buscarDadosDeclaracao(matriculaId: string): Promise<DadosDeclaracao> {
  const supabase = await createServerClient();

  const { data: matricula, error } = await supabase
    .from("matriculas")
    .select(
      "codigo, ano_letivo, serie_id, series(nome, ordem), turmas(nome, turno), alunos(nome, data_nascimento, naturalidade, responsaveis_aluno(nome, parentesco))"
    )
    .eq("id", matriculaId)
    .maybeSingle();
  if (error) throw error;
  if (!matricula) throw new Error(`Matrícula não encontrada: ${matriculaId}`);

  const aluno = matricula.alunos as {
    nome?: string;
    data_nascimento?: string | null;
    naturalidade?: string | null;
    responsaveis_aluno?: Array<{ nome: string; parentesco: string | null }>;
  } | null;
  const serie = matricula.series as { nome?: string; ordem?: number } | null;
  const turma = matricula.turmas as { nome?: string; turno?: string } | null;

  const credenciamento = matricula.serie_id
    ? await getCredenciamentoVigente(matricula.serie_id as string, matricula.ano_letivo as number)
    : null;

  let proximaSerie: string | null = null;
  if (serie?.ordem != null) {
    const { data: proxima } = await supabase
      .from("series")
      .select("nome")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ativo", true)
      .gt("ordem", serie.ordem)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    proximaSerie = (proxima?.nome as string | undefined) ?? null;
  }

  return {
    nomeAluno: aluno?.nome ?? "",
    matricula: (matricula.codigo as string | null) ?? null,
    dataNascimento: aluno?.data_nascimento ?? null,
    naturalidade: aluno?.naturalidade ?? null,
    filiacao: montarFiliacao(aluno?.responsaveis_aluno ?? []),
    anoLetivo: matricula.ano_letivo as number,
    serieCorrente: serie?.nome ?? "",
    turma: turma?.nome ?? "",
    turno: turma?.turno ?? "",
    proximaSerie,
    nomeEmpresa: credenciamento?.nomeFantasia ?? "",
    cidadeEmpresa: credenciamento?.cidade ?? null,
    dataEmissaoIso: new Date().toISOString().slice(0, 10)
  };
}
