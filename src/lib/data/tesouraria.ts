import { createServerClient } from "@/lib/supabase/server";

export async function getTesourariaData() {
  const supabase = await createServerClient();
  const [contas, pix, recebidos] = await Promise.all([
    supabase
      .from("contas_bancarias")
      .select("id, apelido, banco, cooperativa, agencia, conta, chave_pix, ativo, saldo_sincronizado_em")
      .order("criado_em", { ascending: false }),
    supabase
      .from("pix_cobranca")
      .select("id, txid, origem_tipo, origem_id, valor, descricao, status, expira_em, criado_em, contas_bancarias(apelido, conta)")
      .order("criado_em", { ascending: false })
      .limit(20),
    supabase
      .from("pix_recebido")
      .select("id, end_to_end_id, txid, valor, recebido_em, contas_bancarias(apelido, conta)")
      .order("recebido_em", { ascending: false })
      .limit(20),
  ]);

  if (contas.error) throw contas.error;
  if (pix.error) throw pix.error;
  if (recebidos.error) throw recebidos.error;

  return {
    contas: contas.data ?? [],
    pix: pix.data ?? [],
    recebidos: recebidos.data ?? [],
  };
}

export async function getCobrancasPixData() {
  const supabase = await createServerClient();
  const [contas, pix] = await Promise.all([
    supabase
      .from("contas_bancarias")
      .select("id, apelido, agencia, conta, chave_pix")
      .eq("ativo", true)
      .order("criado_em", { ascending: false }),
    supabase
      .from("pix_cobranca")
      .select("id, txid, origem_tipo, valor, descricao, status, expira_em, pix_copia_cola, criado_em, contas_bancarias(apelido, conta)")
      .order("criado_em", { ascending: false })
      .limit(100),
  ]);

  if (contas.error) throw contas.error;
  if (pix.error) throw pix.error;

  return { contas: contas.data ?? [], pix: pix.data ?? [] };
}
