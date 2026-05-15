"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { formBoolean, formText } from "@/lib/utils";

export async function createAttendanceAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  if (!alunoId) return;

  await createAdminClient().from("frequencias").upsert(
    {
      escola_id: DEFAULT_SCHOOL_ID,
      aluno_id: alunoId,
      data_aula: formText(formData, "data_aula") ?? new Date().toISOString().slice(0, 10),
      presente: formBoolean(formData, "presente"),
      justificativa: formText(formData, "justificativa")
    },
    { onConflict: "aluno_id,data_aula" }
  );

  revalidatePath("/frequencias");
}

export async function saveClassAttendanceAction(formData: FormData) {
  const date = formText(formData, "data_aula") ?? new Date().toISOString().slice(0, 10);
  const turmaId = formText(formData, "turma_id");
  const alunoIds = formData.getAll("aluno_id").filter((value): value is string => typeof value === "string");

  if (!turmaId || alunoIds.length === 0) return;

  const rows = alunoIds.map((alunoId) => ({
    escola_id: DEFAULT_SCHOOL_ID,
    aluno_id: alunoId,
    matricula_id: formText(formData, `matricula_id_${alunoId}`),
    data_aula: date,
    presente: formBoolean(formData, `presente_${alunoId}`),
    justificativa: formText(formData, `justificativa_${alunoId}`)
  }));

  await createAdminClient().from("frequencias").upsert(rows, { onConflict: "aluno_id,data_aula" });

  revalidatePath("/frequencias");
  revalidatePath("/frequencias/chamada");
}
