import { createServerClient } from "@/lib/supabase/server";
import { MOTIVO_CANCELAMENTO_LABEL, type MotivoCancelamento } from "@/lib/validation/cancelamento";

export type SaidaAno = {
  id: string;
  alunoNome: string;
  serieNome: string;
  turmaNome: string;
  motivo: string;
  motivoLabel: string;
  data: string;
  cienteCoordenacao: boolean;
  cienteDiretoria: boolean;
};

/**
 * Matrículas canceladas no meio do ano (evento 2) — nunca inclui quem só
 * não renovou (evento 1, sem cancelamento_data). Ver seção "Dois eventos
 * diferentes" da spec.
 */
export async function listarSaidasDoAno(anoLetivo: number): Promise<SaidaAno[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("matriculas")
    .select("id, cancelamento_motivo, cancelamento_data, ciente_coordenacao, ciente_diretoria, alunos(nome), series(nome), turmas(nome)")
    .eq("ano_letivo", anoLetivo)
    .eq("status", "cancelada")
    .not("cancelamento_data", "is", null)
    .order("cancelamento_data", { ascending: false });

  if (error) throw new Error("Não foi possível carregar as saídas do ano.");

  return (data ?? []).map((row: Record<string, unknown>) => {
    const motivo = row.cancelamento_motivo as MotivoCancelamento;
    return {
      id: row.id as string,
      alunoNome: (row.alunos as { nome: string })?.nome ?? "",
      serieNome: (row.series as { nome: string })?.nome ?? "",
      turmaNome: (row.turmas as { nome: string })?.nome ?? "",
      motivo,
      motivoLabel: MOTIVO_CANCELAMENTO_LABEL[motivo] ?? motivo,
      data: row.cancelamento_data as string,
      cienteCoordenacao: row.ciente_coordenacao as boolean,
      cienteDiretoria: row.ciente_diretoria as boolean,
    };
  });
}
