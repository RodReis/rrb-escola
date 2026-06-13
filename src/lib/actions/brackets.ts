"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { BracketSchema, NewVigenciaSchema } from "@/lib/validation/brackets";

function firstError(error: { issues: { message: string }[] }) {
  return encodeURIComponent(error.issues[0]?.message ?? "Dados inválidos");
}

export async function upsertBracketAction(formData: FormData) {
  await requirePermission("rh.folha-v2", "update");

  const parsed = BracketSchema.safeParse({
    table: String(formData.get("table") ?? ""),
    vigencia_inicio: String(formData.get("vigencia_inicio") ?? ""),
    ordem: formData.get("ordem"),
    valor_de: formData.get("valor_de"),
    valor_ate: formData.get("valor_ate"),
    aliquota: formData.get("aliquota"),
    parcela_deduzir: formData.get("parcela_deduzir"),
    deducao_dependente: formData.get("deducao_dependente")
  });
  if (!parsed.success) {
    redirect(`/rh/brackets?erro=${firstError(parsed.error)}`);
  }
  const data = parsed.data;
  const id = String(formData.get("id") ?? "");
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {
    vigencia_inicio: data.vigencia_inicio,
    ordem: data.ordem,
    valor_de: data.valor_de,
    valor_ate: data.valor_ate,
    aliquota: data.aliquota,
    parcela_deduzir: data.parcela_deduzir
  };
  if (data.table === "ir") payload.deducao_dependente = data.deducao_dependente ?? 0;

  const tableName = data.table === "inss" ? "inss_brackets" : "ir_brackets";
  const { error } = id
    ? await supabase.from(tableName).update(payload).eq("id", id)
    : await supabase.from(tableName).insert(payload);

  if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/brackets");
  redirect(`/rh/brackets?ok=salvo&tab=${data.table}`);
}

export async function deleteBracketAction(formData: FormData) {
  await requirePermission("rh.folha-v2", "delete");
  const table = String(formData.get("table") ?? "");
  const id = String(formData.get("id") ?? "");
  if (table !== "inss" && table !== "ir") redirect("/rh/brackets?erro=Tabela inválida");
  if (!id) redirect("/rh/brackets?erro=ID inválido");

  const supabase = await createServerClient();
  const tableName = table === "inss" ? "inss_brackets" : "ir_brackets";
  const { error } = await supabase.from(tableName).delete().eq("id", id);
  if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/brackets");
  redirect(`/rh/brackets?ok=removido&tab=${table}`);
}

export async function createBracketVigenciaAction(formData: FormData) {
  await requirePermission("rh.folha-v2", "create");
  const parsed = NewVigenciaSchema.safeParse({
    table: String(formData.get("table") ?? ""),
    vigencia_inicio: String(formData.get("vigencia_inicio") ?? ""),
    copy_from: formData.get("copy_from")
  });
  if (!parsed.success) redirect(`/rh/brackets?erro=${firstError(parsed.error)}`);
  const { table, vigencia_inicio, copy_from } = parsed.data;

  const supabase = await createServerClient();
  const tableName = table === "inss" ? "inss_brackets" : "ir_brackets";

  if (copy_from) {
    const { data: source } = await supabase
      .from(tableName)
      .select("*")
      .eq("vigencia_inicio", copy_from)
      .order("ordem");
    const rows = (source ?? []).map((r) => {
      const copy: Record<string, unknown> = {
        vigencia_inicio,
        ordem: r.ordem,
        valor_de: r.valor_de,
        valor_ate: r.valor_ate,
        aliquota: r.aliquota,
        parcela_deduzir: r.parcela_deduzir
      };
      if (table === "ir") copy.deducao_dependente = r.deducao_dependente ?? 0;
      return copy;
    });
    if (rows.length > 0) {
      const { error } = await supabase.from(tableName).insert(rows);
      if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);
    }
  } else {
    // Create empty vigencia with one placeholder bracket (ordem 1)
    const payload: Record<string, unknown> = {
      vigencia_inicio,
      ordem: 1,
      valor_de: 0,
      valor_ate: null,
      aliquota: 0,
      parcela_deduzir: 0
    };
    if (table === "ir") payload.deducao_dependente = 0;
    const { error } = await supabase.from(tableName).insert(payload);
    if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/rh/brackets");
  redirect(`/rh/brackets?ok=vigencia_criada&tab=${table}&vigencia=${vigencia_inicio}`);
}

export async function deleteVigenciaAction(formData: FormData) {
  await requirePermission("rh.folha-v2", "delete");
  const table = String(formData.get("table") ?? "");
  const vigencia = String(formData.get("vigencia") ?? "");
  if (table !== "inss" && table !== "ir") redirect("/rh/brackets?erro=Tabela inválida");

  const supabase = await createServerClient();
  const tableName = table === "inss" ? "inss_brackets" : "ir_brackets";
  const { error } = await supabase.from(tableName).delete().eq("vigencia_inicio", vigencia);
  if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/brackets");
  redirect(`/rh/brackets?ok=vigencia_removida&tab=${table}`);
}
