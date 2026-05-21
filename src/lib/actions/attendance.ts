"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formBoolean, formText } from "@/lib/utils";
import { getCalendario } from "@/lib/data/calendario";
import { isDiaLetivo } from "@/lib/calendario/dias-letivos";

export async function createAttendanceAction(formData: FormData) {
  await requirePermission("frequencias", "create");
  const alunoId = formText(formData, "aluno_id");
  if (!alunoId) return;

  const supabase = await createServerClient();
  await supabase.from("frequencias").upsert(
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
  await requirePermission("frequencias", "create");
  const date = formText(formData, "data_aula") ?? new Date().toISOString().slice(0, 10);
  const turmaId = formText(formData, "turma_id");
  const alunoIds = formData.getAll("aluno_id").filter((value): value is string => typeof value === "string");

  if (!turmaId || alunoIds.length === 0) return;

  const anoLetivo = Number(date.slice(0, 4));
  const cal = await getCalendario(anoLetivo);
  if (cal && !isDiaLetivo(date, cal.calendario, cal.excecoes)) {
    throw new Error("Data não é um dia letivo no calendário. Verifique o calendário letivo.");
  }

  const rows = alunoIds.map((alunoId) => ({
    escola_id: DEFAULT_SCHOOL_ID,
    aluno_id: alunoId,
    matricula_id: formText(formData, `matricula_id_${alunoId}`),
    data_aula: date,
    presente: formBoolean(formData, `presente_${alunoId}`),
    justificativa: formText(formData, `justificativa_${alunoId}`)
  }));

  const supabase = await createServerClient();
  await supabase.from("frequencias").upsert(rows, { onConflict: "aluno_id,data_aula" });

  revalidatePath("/frequencias");
  revalidatePath("/frequencias/chamada");
}
