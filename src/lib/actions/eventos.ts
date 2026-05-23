"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formText } from "@/lib/utils";

export async function salvarEventoAction(formData: FormData) {
  const id = formText(formData, "id");
  await requirePermission("eventos", id ? "update" : "create");

  const titulo = formText(formData, "titulo");
  const dataInicio = formText(formData, "data_inicio");
  const dataFim = formText(formData, "data_fim");
  const descricao = formText(formData, "descricao") || null;
  const local = formText(formData, "local") || null;

  if (!titulo) throw new Error("Título é obrigatório");
  if (!dataInicio || !dataFim) throw new Error("Datas de início e fim são obrigatórias");
  if (dataFim < dataInicio) throw new Error("Data fim deve ser maior ou igual à data início");

  const supabase = await createServerClient();
  const payload = {
    escola_id: DEFAULT_SCHOOL_ID,
    titulo,
    data_inicio: dataInicio,
    data_fim: dataFim,
    descricao,
    local,
  };

  if (id) {
    const { error } = await supabase
      .from("eventos_escola")
      .update(payload)
      .eq("id", id)
      .eq("escola_id", DEFAULT_SCHOOL_ID);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("eventos_escola").insert(payload);
    if (error) throw error;
  }

  revalidatePath("/eventos");
  revalidatePath("/");
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
