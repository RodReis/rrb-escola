"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formText, formNumber } from "@/lib/utils";

function parseDiasSemana(formData: FormData): number[] {
  // Checkboxes name="dia_semana" value="0".."6"
  return formData
    .getAll("dia_semana")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export async function salvarCalendarioAction(formData: FormData) {
  await requirePermission("calendario", "create");
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  const anoLetivo = formNumber(formData, "ano_letivo");
  const dataInicio = formText(formData, "data_inicio");
  const dataFim = formText(formData, "data_fim");
  const diasSemana = parseDiasSemana(formData);

  if (!anoLetivo || !dataInicio || !dataFim) {
    throw new Error("Ano letivo, data início e data fim são obrigatórios");
  }
  if (dataFim <= dataInicio) {
    throw new Error("Data fim deve ser posterior à data início");
  }
  if (diasSemana.length === 0) {
    throw new Error("Selecione ao menos um dia da semana letivo");
  }

  const payload = {
    escola_id: DEFAULT_SCHOOL_ID,
    ano_letivo: anoLetivo,
    data_inicio: dataInicio,
    data_fim: dataFim,
    dias_semana_letivos: diasSemana,
  };

  if (id) {
    await supabase.from("calendario_letivo").update(payload).eq("id", id).eq("escola_id", DEFAULT_SCHOOL_ID);
  } else {
    await supabase.from("calendario_letivo").insert(payload);
  }

  revalidatePath("/calendario");
}

export async function salvarExcecaoAction(formData: FormData) {
  await requirePermission("calendario", "update");
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  const calendarioId = formText(formData, "calendario_id");
  const dataInicio = formText(formData, "data_inicio");
  const dataFim = formText(formData, "data_fim");
  const tipo = formText(formData, "tipo");
  const descricao = formText(formData, "descricao");

  if (!calendarioId || !dataInicio || !dataFim || !tipo || !descricao) {
    throw new Error("Todos os campos da exceção são obrigatórios");
  }
  if (tipo !== "feriado" && tipo !== "recesso") {
    throw new Error("Tipo de exceção inválido");
  }
  if (dataFim < dataInicio) {
    throw new Error("Data fim não pode ser anterior à data início");
  }

  const payload = {
    calendario_id: calendarioId,
    escola_id: DEFAULT_SCHOOL_ID,
    data_inicio: dataInicio,
    data_fim: dataFim,
    tipo,
    descricao,
  };

  if (id) {
    await supabase.from("calendario_excecoes").update(payload).eq("id", id).eq("escola_id", DEFAULT_SCHOOL_ID);
  } else {
    await supabase.from("calendario_excecoes").insert(payload);
  }

  revalidatePath("/calendario");
}

export async function excluirExcecaoAction(formData: FormData) {
  await requirePermission("calendario", "delete");
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  if (!id) throw new Error("ID obrigatório");

  await supabase.from("calendario_excecoes").delete().eq("id", id).eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/calendario");
}
