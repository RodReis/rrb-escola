import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export async function getAcademicData() {
  const supabase = await createServerClient();
  const [series, turmas, planos, alunos] = await Promise.all([
    supabase.from("series").select("*").eq("escola_id", DEFAULT_SCHOOL_ID).order("ordem"),
    supabase.from("turmas").select("*, series(nome)").eq("escola_id", DEFAULT_SCHOOL_ID).order("ano_letivo", { ascending: false }),
    supabase.from("planos").select("*").eq("escola_id", DEFAULT_SCHOOL_ID).order("nome"),
    supabase
      .from("alunos")
      .select("id, nome, matricula_codigo, data_nascimento, matriculas(ano_letivo, status, serie_id)")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .order("nome")
  ]);

  if (series.error) throw series.error;
  if (turmas.error) throw turmas.error;
  if (planos.error) throw planos.error;
  if (alunos.error) throw alunos.error;

  return {
    series: series.data ?? [],
    turmas: turmas.data ?? [],
    planos: planos.data ?? [],
    alunos: alunos.data ?? []
  };
}
