import { createServerClient } from "@/lib/supabase/server";

export type ConciliacaoFilters = {
  status: string;
  contaId?: string;
  de?: string;
  ate?: string;
};

export async function getConciliacaoData(filters: ConciliacaoFilters) {
  const supabase = await createServerClient();
  let extratoQuery = supabase
    .from("extrato_bancario")
    .select(`
      id, data, tipo, valor, descricao, end_to_end_id, status_conciliacao, conta_id,
      contas_bancarias(conta, agencia, chave_pix)
    `)
    .eq("status_conciliacao", filters.status)
    .order("data", { ascending: false })
    .limit(100);

  if (filters.contaId) extratoQuery = extratoQuery.eq("conta_id", filters.contaId);
  if (filters.de) extratoQuery = extratoQuery.gte("data", filters.de);
  if (filters.ate) extratoQuery = extratoQuery.lte("data", filters.ate);

  const [extrato, pagamentos, lancamentos, contas] = await Promise.all([
    extratoQuery,
    supabase
      .from("pagamentos")
      .select("id, data_pagamento, valor_pago, forma_pagamento, cobrancas(descricao, alunos(nome))")
      .is("cancelado_em", null)
      .order("data_pagamento", { ascending: false })
      .limit(200),
    supabase
      .from("lancamento_financeiro")
      .select("id, data_vencimento, descricao, valor, tipo, status")
      .neq("status", "cancelada")
      .order("data_vencimento", { ascending: false })
      .limit(200),
    supabase
      .from("contas_bancarias")
      .select("id, conta, agencia, chave_pix, ativo")
      .eq("ativo", true),
  ]);

  if (extrato.error) throw extrato.error;
  if (pagamentos.error) throw pagamentos.error;
  if (lancamentos.error) throw lancamentos.error;
  if (contas.error) throw contas.error;

  const totalExtrato = (extrato.data ?? []).reduce((sum, item) => {
    const valor = Number(item.valor ?? 0);
    return item.tipo === "credito" ? sum + valor : sum - valor;
  }, 0);

  return {
    extrato: extrato.data ?? [],
    pagamentos: pagamentos.data ?? [],
    lancamentos: lancamentos.data ?? [],
    contas: contas.data ?? [],
    totalExtrato,
  };
}
