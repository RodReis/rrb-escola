"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formText } from "@/lib/utils";

export type SalvarEventoResult = { ok: true; created: boolean } | { ok: false; error: string };

export async function salvarEventoAction(
  _prevState: SalvarEventoResult | null,
  formData: FormData,
): Promise<SalvarEventoResult> {
  const id = formText(formData, "id");
  await requirePermission("eventos", id ? "update" : "create");

  const titulo = formText(formData, "titulo");
  const dataInicio = formText(formData, "data_inicio");
  const dataFim = formText(formData, "data_fim");
  const descricao = formText(formData, "descricao") || null;
  const local = formText(formData, "local") || null;

  if (!titulo) return { ok: false, error: "Título é obrigatório" };
  if (!dataInicio || !dataFim) return { ok: false, error: "Datas de início e fim são obrigatórias" };
  if (dataFim < dataInicio) return { ok: false, error: "Data fim deve ser maior ou igual à data início" };

  const supabase = await createServerClient();
  const payload = {
    escola_id: DEFAULT_SCHOOL_ID,
    titulo,
    data_inicio: dataInicio,
    data_fim: dataFim,
    descricao,
    local,
  };

  // Anti-duplicata: mesmo titulo + data_inicio + data_fim na mesma escola
  const { data: existente } = await supabase
    .from("eventos_escola")
    .select("id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("titulo", titulo)
    .eq("data_inicio", dataInicio)
    .eq("data_fim", dataFim)
    .maybeSingle();
  if (existente && existente.id !== id) {
    return { ok: false, error: "Já existe um evento com mesmo título e datas." };
  }

  if (id) {
    const { error } = await supabase
      .from("eventos_escola")
      .update(payload)
      .eq("id", id)
      .eq("escola_id", DEFAULT_SCHOOL_ID);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("eventos_escola").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/eventos");
  revalidatePath("/");
  return { ok: true, created: !id };
}

export async function excluirEventoAction(formData: FormData) {
  await requirePermission("eventos", "delete");
  const id = formText(formData, "id");
  if (!id) throw new Error("ID do evento é obrigatório");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("eventos_escola")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) throw error;

  revalidatePath("/eventos");
  revalidatePath("/");
}
