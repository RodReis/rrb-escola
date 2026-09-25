import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { planejarCompetencia, type Recorrente } from "@/lib/previsto/recorrencia";

export type ResultadoGeracao = { criados: number; jaExistiam: number; aguardandoValor: number };

export function competenciaDe(data: Date): string {
  return data.toISOString().slice(0, 7);
}

export async function carregarRecorrentes(supabase: SupabaseClient, escolaId?: string): Promise<Recorrente[]> {
  let q = supabase
    .from("despesa_recorrente")
    .select("id, escola_id, company_id, descricao, categoria_id, contraparte, valor_referencia, dia_vencimento, classe_despesa, ativo, inicio_competencia, fim_competencia")
    .eq("ativo", true);
  if (escolaId) q = q.eq("escola_id", escolaId);
  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id as string,
    escolaId: r.escola_id as string,
    companyId: (r.company_id as string | null) ?? null,
    descricao: r.descricao as string,
    categoriaId: r.categoria_id as string,
    contraparte: (r.contraparte as string | null) ?? null,
    valorReferencia: r.valor_referencia === null ? null : Number(r.valor_referencia),
    diaVencimento: r.dia_vencimento as number,
    classeDespesa: (r.classe_despesa as "fixa" | "variavel" | null) ?? null,
    ativo: r.ativo as boolean,
    inicioCompetencia: r.inicio_competencia as string,
    fimCompetencia: (r.fim_competencia as string | null) ?? null,
  }));
}

/**
 * Gera os títulos da competência. Idempotente por dois caminhos: consulta o que
 * já existe (recorrente_id, competencia) e, se o job diário e um clique na tela
 * correrem juntos, o índice único parcial devolve 23505, tratado como "já existe".
 * (Upsert do PostgREST não consegue mirar índice parcial — mesma razão da RPC
 * classificar_debito.)
 */
export async function gerarRecorrentes(
  supabase: SupabaseClient,
  competencia: string,
  escolaId?: string,
): Promise<ResultadoGeracao> {
  const recorrentes = await carregarRecorrentes(supabase, escolaId);
  const { gerar, aguardandoValor } = planejarCompetencia(recorrentes, competencia);
  if (gerar.length === 0) return { criados: 0, jaExistiam: 0, aguardandoValor: aguardandoValor.length };

  const { data: existentes, error } = await supabase
    .from("lancamento_financeiro")
    .select("recorrente_id")
    .eq("competencia", competencia)
    .in("recorrente_id", gerar.map((t) => t.recorrente_id));
  if (error) throw error;

  const jaTem = new Set((existentes ?? []).map((e) => e.recorrente_id as string));
  let criados = 0;
  let jaExistiam = jaTem.size;

  for (const titulo of gerar) {
    if (jaTem.has(titulo.recorrente_id)) continue;
    const { error: insErr } = await supabase.from("lancamento_financeiro").insert(titulo);
    if (!insErr) {
      criados += 1;
    } else if (insErr.code === "23505") {
      jaExistiam += 1;
    } else {
      throw insErr;
    }
  }

  return { criados, jaExistiam, aguardandoValor: aguardandoValor.length };
}
