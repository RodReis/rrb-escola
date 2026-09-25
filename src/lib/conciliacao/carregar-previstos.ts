import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { documentoDePrevisto, type PrevistoAberto } from "@/lib/conciliacao/baixa-previsto";

export type PrevistoComDescricao = PrevistoAberto & { descricao: string };

const TAMANHO_PAGINA = 1000;

/**
 * Títulos de despesa em aberto da escola, prontos para o casamento.
 * Pagina em loop com `.order("id")` explícito — sem ordem, um UPDATE concorrente
 * entre duas páginas pode mover uma linha e pulá-la (ver carregar-pendentes.ts).
 */
export async function carregarPrevistosAbertos(
  supabase: SupabaseClient,
  escolaId: string,
): Promise<PrevistoComDescricao[]> {
  const previstos: PrevistoComDescricao[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("lancamento_financeiro")
      .select("id, descricao, valor, data_vencimento, contraparte, company_id")
      .eq("escola_id", escolaId)
      .eq("tipo", "despesa")
      .eq("status", "aberta")
      .order("id")
      .range(offset, offset + TAMANHO_PAGINA - 1);
    if (error) throw error;

    for (const l of data ?? []) {
      previstos.push({
        id: l.id as string,
        descricao: String(l.descricao ?? ""),
        valor: Number(l.valor),
        dataVencimento: l.data_vencimento as string,
        documento: documentoDePrevisto((l.contraparte as string | null) ?? null),
        companyId: (l.company_id as string | null) ?? null,
      });
    }

    if (!data || data.length < TAMANHO_PAGINA) break;
    offset += TAMANHO_PAGINA;
  }

  return previstos;
}
