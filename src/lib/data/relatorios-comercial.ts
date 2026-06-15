import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { LancamentoDRE } from "@/lib/relatorios/dre";
import type { GiroVariacao } from "@/lib/relatorios/abc";
import type { VariacaoParadaInput } from "@/lib/relatorios/estoque-parado";

// Lançamentos do razão para o DRE (filtra por intervalo de competência).
export async function getLancamentosParaDRE(deComp: string, ateComp: string): Promise<LancamentoDRE[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("lancamento_financeiro")
    .select("tipo, categoria_id, valor, status, evento_id, categorias_financeiras(nome), eventos_escola(titulo)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .gte("competencia", deComp)
    .lte("competencia", ateComp);
  if (error) throw error;
  return (data ?? []).map((l: any) => ({
    tipo: l.tipo,
    categoria_id: l.categoria_id,
    categoria_nome: l.categorias_financeiras?.nome ?? null,
    valor: Number(l.valor),
    status: l.status,
    evento_id: l.evento_id,
    evento_nome: l.eventos_escola?.titulo ?? null
  }));
}

// Giro por variação (volume de saída) no período, para a curva ABC.
export async function getGiroVariacoes(deData: string, ateData: string): Promise<GiroVariacao[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("movimento_estoque")
    .select("variacao_id, quantidade, produto_variacao(sku, atributos, produto(nome))")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("tipo", "saida")
    .gte("data", deData)
    .lte("data", ateData);
  if (error) throw error;

  const mapa = new Map<string, GiroVariacao>();
  for (const m of (data ?? []) as any[]) {
    const pv = m.produto_variacao;
    const attrs = pv?.atributos ? Object.values(pv.atributos).join(" ") : "";
    const rotulo = `${pv?.produto?.nome ?? "—"}${pv?.sku ? ` (${pv.sku})` : ""}${attrs ? ` ${attrs}` : ""}`;
    const atual = mapa.get(m.variacao_id) ?? { variacao_id: m.variacao_id, rotulo, quantidadeSaida: 0 };
    atual.quantidadeSaida += m.quantidade;
    mapa.set(m.variacao_id, atual);
  }
  return Array.from(mapa.values());
}

// Saldo + última saída + custo por variação, para estoque parado e imobilizado.
export async function getVariacoesParaParado(): Promise<VariacaoParadaInput[]> {
  const supabase = await createServerClient();
  const [{ data: variacoes, error: e1 }, { data: saldos, error: e2 }] = await Promise.all([
    supabase
      .from("produto_variacao")
      .select("id, sku, atributos, custo, ativo, produto(nome)")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ativo", true),
    supabase
      .from("saldo_estoque")
      .select("variacao_id, saldo, ultima_saida")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const saldoMap = new Map<string, { saldo: number; ultima_saida: string | null }>();
  (saldos ?? []).forEach((s: any) => saldoMap.set(s.variacao_id, { saldo: Number(s.saldo), ultima_saida: s.ultima_saida }));

  return (variacoes ?? []).map((v: any) => {
    const s = saldoMap.get(v.id) ?? { saldo: 0, ultima_saida: null };
    const attrs = v.atributos ? Object.values(v.atributos).join(" ") : "";
    return {
      variacao_id: v.id,
      rotulo: `${v.produto?.nome ?? "—"}${v.sku ? ` (${v.sku})` : ""}${attrs ? ` ${attrs}` : ""}`,
      saldo: s.saldo,
      custo: Number(v.custo),
      ultimaSaida: s.ultima_saida
    };
  });
}
