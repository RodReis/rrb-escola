import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Linhas de extrato_bancario usadas pelo pipeline de débitos e pela tela.
 * Campo a campo (não `select("*")`) para os dois consumidores pedirem
 * exatamente o que usam.
 */
export type LinhaPendente = {
  id: string;
  conta_id: string;
  data: string;
  valor: number;
  tipo: "debito" | "credito";
  descricao: string | null;
  contraparte_doc: string | null;
  status_conciliacao: string;
  pareamento_recusado: boolean;
};

/**
 * PostgREST corta em 1000 linhas por padrão (supabase/config.toml,
 * max_rows). Um `.select()` sem paginação sobre `pendente` silenciosamente
 * descarta o resto — com 1220 linhas pendentes em produção, 220 somem sem
 * erro nenhum. Pior caso: um débito com 2 créditos candidatos em contas
 * diferentes (que deveria virar "ambíguo") vê só 1 candidato se o outro cair
 * fora do corte, e o pipeline GRAVA SOZINHO um par que era pra ser revisado
 * manualmente — exatamente o erro que a detecção de transferência interna
 * existe para prevenir.
 *
 * Pagina de verdade em loop com `.range()` até a página vir menor que o
 * tamanho pedido (ou vazia) — não confia em nenhum total prévio.
 */
const TAMANHO_PAGINA = 1000;

export async function carregarPendentes(
  supabase: SupabaseClient,
  escolaId: string,
  status: string[],
): Promise<LinhaPendente[]> {
  const linhas: LinhaPendente[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("extrato_bancario")
      .select("id, conta_id, data, valor, tipo, descricao, contraparte_doc, status_conciliacao, pareamento_recusado")
      .eq("escola_id", escolaId)
      .in("status_conciliacao", status)
      .range(offset, offset + TAMANHO_PAGINA - 1);

    if (error) throw error;

    const pagina = (data ?? []) as LinhaPendente[];
    linhas.push(...pagina);

    if (pagina.length < TAMANHO_PAGINA) break;
    offset += TAMANHO_PAGINA;
  }

  return linhas;
}
