import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export interface SaldoVariacaoRow {
  variacao_id: string;
  produto_nome: string;
  sku: string | null;
  atributos: Record<string, string>;
  saldo: number;
  estoque_minimo: number;
  custo: number;
  ultima_saida: string | null;
  precisa_reposicao: boolean;
}

// Junta view saldo_estoque + dados da variação/produto. View não tem nome/min,
// então buscamos as variações e mesclamos o saldo por variacao_id.
export async function getSaldos(): Promise<SaldoVariacaoRow[]> {
  const supabase = await createServerClient();

  const [{ data: variacoes, error: errVar }, { data: saldos, error: errSaldo }] = await Promise.all([
    supabase
      .from("produto_variacao")
      .select("id, sku, atributos, estoque_minimo, custo, ativo, produto(nome)")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ativo", true),
    supabase
      .from("saldo_estoque")
      .select("variacao_id, saldo, ultima_saida")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
  ]);
  if (errVar) throw errVar;
  if (errSaldo) throw errSaldo;

  const saldoMap = new Map<string, { saldo: number; ultima_saida: string | null }>();
  (saldos ?? []).forEach((s: any) => saldoMap.set(s.variacao_id, { saldo: Number(s.saldo), ultima_saida: s.ultima_saida }));

  return (variacoes ?? []).map((v: any) => {
    const s = saldoMap.get(v.id) ?? { saldo: 0, ultima_saida: null };
    return {
      variacao_id: v.id,
      produto_nome: v.produto?.nome ?? "—",
      sku: v.sku,
      atributos: (v.atributos ?? {}) as Record<string, string>,
      saldo: s.saldo,
      estoque_minimo: v.estoque_minimo,
      custo: Number(v.custo),
      ultima_saida: s.ultima_saida,
      precisa_reposicao: s.saldo <= v.estoque_minimo
    };
  });
}

export async function getAlertasReposicao(): Promise<SaldoVariacaoRow[]> {
  const saldos = await getSaldos();
  return saldos.filter((s) => s.precisa_reposicao);
}
