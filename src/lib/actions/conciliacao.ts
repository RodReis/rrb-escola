"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { syncExtratoSicoob } from "@/lib/conciliacao/sync-extrato";

export type AtualizarExtratoResult =
  | { ok: true; movimentos: number; descartados: number }
  | { ok: false; error: string };

// Erros do Supabase são objetos simples com `message`/`details`, não instâncias
// de Error — extrair o texto evita perder a causa real no relatório.
function descreverErro(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const texto = e.message ?? e.details ?? e.hint;
    if (texto) return e.code ? `${texto} (${e.code})` : texto;
  }
  return "Falha ao sincronizar extrato";
}

export async function atualizarExtratoAction(
  _prev: AtualizarExtratoResult | null,
  _formData: FormData,
): Promise<AtualizarExtratoResult> {
  await requirePermission("financeiro.conciliacao", "update");
  try {
    const resultado = await syncExtratoSicoob();
    revalidatePath("/financeiro/tesouraria/conciliacao");
    return { ok: true, movimentos: resultado.movimentos, descartados: resultado.descartados };
  } catch (err) {
    console.error("[conciliacao] falha ao sincronizar extrato", err);
    return { ok: false, error: descreverErro(err) };
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
