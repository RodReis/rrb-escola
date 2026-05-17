"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formNumber, formText } from "@/lib/utils";

export async function createDisciplinaAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();

  const serieId = formText(formData, "serie_id");
  const nome = formText(formData, "nome");
  if (!serieId || !nome) throw new Error("Série e nome obrigatórios");

  await supabase.from("disciplinas").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    serie_id: serieId,
    nome,
    ordem: formNumber(formData, "ordem") ?? 0,
    ativo: true,
  });

  revalidatePath("/disciplinas");
}

export async function updateDisciplinaAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  if (!id || !nome) throw new Error("ID e nome obrigatórios");

  await supabase
    .from("disciplinas")
    .update({
      nome,
      ordem: formNumber(formData, "ordem") ?? 0,
      ativo: formData.get("ativo") === "on",
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/disciplinas");
}

export async function deleteDisciplinaAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  if (!id) throw new Error("ID obrigatório");

  await supabase
    .from("disciplinas")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/disciplinas");
}

export async function createAtribuicaoAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();

  const perfilId = formText(formData, "perfil_id");
  const disciplinaId = formText(formData, "disciplina_id");
  const turmaId = formText(formData, "turma_id");
  if (!perfilId || !disciplinaId || !turmaId) throw new Error("Todos campos obrigatórios");

  await supabase.from("professor_disciplina_turma").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    perfil_id: perfilId,
    disciplina_id: disciplinaId,
    turma_id: turmaId,
  });

  revalidatePath("/professores/atribuicoes");
}

export async function deleteAtribuicaoAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  if (!id) throw new Error("ID obrigatório");

  await supabase
    .from("professor_disciplina_turma")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/professores/atribuicoes");
}
