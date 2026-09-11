"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { syncExtratoSicoob } from "@/lib/conciliacao/sync-extrato";

export type AtualizarExtratoResult =
  | { ok: true; movimentos: number }
  | { ok: false; reason: string };

export async function atualizarExtratoAction(
  _prev: AtualizarExtratoResult | null,
  _formData: FormData,
): Promise<AtualizarExtratoResult> {
  await requirePermission("financeiro.conciliacao", "update");
  try {
    const resultado = await syncExtratoSicoob();
    revalidatePath("/financeiro/tesouraria/conciliacao");
    return { ok: true, movimentos: resultado.movimentos };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Falha ao sincronizar extrato" };
  }
}

export async function ignorarExtratoAction(formData: FormData) {
  await requirePermission("financeiro.conciliacao", "update");
  const id = String(formData.get("id") ?? "");
  const supabase = await createServerClient();
  await supabase
    .from("extrato_bancario")
    .update({ status_conciliacao: "ignorado" })
    .eq("id", id);
  revalidatePath("/financeiro/tesouraria/conciliacao");
}

export async function conciliarExtratoAction(formData: FormData) {
  const session = await requirePermission("financeiro.conciliacao", "update");
  const id = String(formData.get("id") ?? "");
  const pagamentoId = String(formData.get("pagamento_id") ?? "");
  const lancamentoId = String(formData.get("lancamento_id") ?? "");
  const supabase = await createServerClient();

  const { data: linha } = await supabase
    .from("extrato_bancario")
    .select("valor")
    .eq("id", id)
    .maybeSingle();

  if (pagamentoId) {
    await supabase.from("conciliacao_vinculo").upsert({
      extrato_id: id,
      alvo_tipo: "pagamento",
      alvo_id: pagamentoId,
      valor: Number(linha?.valor ?? 0),
      origem: "manual",
      criado_por: session.profile.id,
    }, { onConflict: "extrato_id,alvo_tipo,alvo_id" });
  }

  if (lancamentoId) {
    await supabase.from("conciliacao_vinculo").upsert({
      extrato_id: id,
      alvo_tipo: "lancamento",
      alvo_id: lancamentoId,
      valor: Number(linha?.valor ?? 0),
      origem: "manual",
      criado_por: session.profile.id,
    }, { onConflict: "extrato_id,alvo_tipo,alvo_id" });
  }

  await supabase.from("extrato_bancario").update({ status_conciliacao: "manual" }).eq("id", id);

  revalidatePath("/financeiro/tesouraria/conciliacao");
}
