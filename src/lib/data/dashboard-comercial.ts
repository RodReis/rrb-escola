import { createServerClient } from "@/lib/supabase/server";

export interface ComercialResumo {
  receitaVendas: number;      // receita de vendas pagas na competência
  vendasConfirmadas: number;  // nº de vendas confirmadas na competência
  imobilizado: number;        // Σ saldo × custo (estoque atual)
  alertasReposicao: number;   // variações com saldo <= mínimo
}

// Resumo comercial para o painel do dashboard. Tudo escopado por escola.
export async function getComercialResumo(competencia: string, escolaId: string): Promise<ComercialResumo> {
  const supabase = await createServerClient();

  const [receitaRes, vendasRes, variacoesRes, saldosRes] = await Promise.all([
    // receita de vendas pagas na competência (origem=venda)
    supabase
      .from("lancamento_financeiro")
      .select("valor")
      .eq("escola_id", escolaId)
      .eq("competencia", competencia)
      .eq("origem_tipo", "venda")
      .eq("status", "paga"),
    // vendas confirmadas na competência (data_venda no mês)
    supabase
      .from("venda")
      .select("id, data_venda, status")
      .eq("escola_id", escolaId)
      .eq("status", "confirmada")
      .gte("data_venda", `${competencia}-01`)
      .lte("data_venda", `${competencia}-31`),
    // variações ativas (custo + estoque_minimo)
    supabase
      .from("produto_variacao")
      .select("id, custo, estoque_minimo")
      .eq("escola_id", escolaId)
      .eq("ativo", true),
    // saldos
    supabase
      .from("saldo_estoque")
      .select("variacao_id, saldo")
      .eq("escola_id", escolaId),
  ]);

  const receitaVendas = (receitaRes.data ?? []).reduce((a, r: any) => a + Number(r.valor), 0);
  const vendasConfirmadas = (vendasRes.data ?? []).length;

  const saldoMap = new Map<string, number>();
  (saldosRes.data ?? []).forEach((s: any) => saldoMap.set(s.variacao_id, Number(s.saldo)));

  let imobilizado = 0;
  let alertasReposicao = 0;
  for (const v of (variacoesRes.data ?? []) as any[]) {
    const saldo = saldoMap.get(v.id) ?? 0;
    imobilizado += saldo * Number(v.custo);
    if (saldo <= v.estoque_minimo) alertasReposicao += 1;
  }

  return { receitaVendas, vendasConfirmadas, imobilizado, alertasReposicao };
}
