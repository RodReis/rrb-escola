import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { AlunoElegivel } from "@/lib/historico/elegiveis";
import type { NivelEnsino } from "@/lib/historico/tipos";
import { createServerClient } from "@/lib/supabase/server";

export type FiltroElegiveis = {
  anoLetivo: number;
  nivel: NivelEnsino;
  serieId?: string;
  turmaId?: string;
  alunoId?: string;
};

export async function listarElegiveis(filtro: FiltroElegiveis): Promise<AlunoElegivel[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("matriculas")
    .select("aluno_id, alunos(id, nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", filtro.anoLetivo)
    .eq("status", "ativa");

  if (filtro.serieId) query = query.eq("serie_id", filtro.serieId);
  if (filtro.turmaId) query = query.eq("turma_id", filtro.turmaId);
  if (filtro.alunoId) query = query.eq("aluno_id", filtro.alunoId);

  const { data, error } = await query;
  if (error) throw error;

  const alunos = (data ?? [])
    .map((row) => row.alunos as { id?: string; nome?: string } | null)
    .filter((a): a is { id: string; nome: string } => Boolean(a?.id && a?.nome));

  if (alunos.length === 0) return [];

  const { data: historicos, error: erroHistoricos } = await supabase
    .from("historico_escolar")
    .select("aluno_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("nivel", filtro.nivel)
    .in("aluno_id", alunos.map((a) => a.id));
  if (erroHistoricos) throw erroHistoricos;

  const comHistorico = new Set((historicos ?? []).map((h) => h.aluno_id as string));

  return alunos
    .map((a) => ({ id: a.id, nome: a.nome, temHistorico: comHistorico.has(a.id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
