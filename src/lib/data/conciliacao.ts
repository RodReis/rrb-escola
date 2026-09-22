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
      .select("id, apelido, conta, agencia, chave_pix, ativo, company_id, companies(name)")
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
    contas: (contas.data ?? []).map((conta) => {
      const empresa = Array.isArray(conta.companies) ? conta.companies[0] : conta.companies;
      return { ...conta, empresaNome: (empresa?.name as string | undefined) ?? null };
    }),
    totalExtrato,
  };
}

export type TransferenciaIsaacPendente = {
  id: string;
  dataPrevista: string;
  valor: number;
  competenciaRepasse: string;
  unidadeNome: string;
  /** Dias de atraso. Negativo = ainda não venceu. */
  atrasoDias: number;
};

/**
 * Transferências do repasse isaac que ainda não casaram com um crédito.
 *
 * O repasse chega em duas parcelas (dia 05 e dia 15). Transferência prevista
 * que não apareceu no extrato é dinheiro que a escola deveria ter recebido e
 * não recebeu — silêncio aqui é o pior resultado possível.
 */
export async function getTransferenciasIsaacPendentes(
  hoje = new Date(),
): Promise<TransferenciaIsaacPendente[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("isaac_transferencia")
    .select("id, data_prevista, valor, isaac_repasse(competencia_repasse, isaac_unidade(nome_isaac))")
    .is("extrato_id", null)
    .order("data_prevista");

  if (error) throw error;

  const hojeMs = new Date(`${hoje.toISOString().slice(0, 10)}T12:00:00Z`).getTime();

  return (data ?? []).map((row) => {
    const repasse = Array.isArray(row.isaac_repasse) ? row.isaac_repasse[0] : row.isaac_repasse;
    const unidade = repasse
      ? Array.isArray(repasse.isaac_unidade)
        ? repasse.isaac_unidade[0]
        : repasse.isaac_unidade
      : null;
    const prevista = new Date(`${row.data_prevista as string}T12:00:00Z`).getTime();
    return {
      id: row.id as string,
      dataPrevista: row.data_prevista as string,
      valor: Number(row.valor),
      competenciaRepasse: (repasse?.competencia_repasse as string) ?? "—",
      unidadeNome: (unidade?.nome_isaac as string) ?? "—",
      atrasoDias: Math.round((hojeMs - prevista) / 86_400_000),
    };
  });
}
