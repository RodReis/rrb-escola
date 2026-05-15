"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { formText } from "@/lib/utils";

export async function setConsentAction(formData: FormData) {
  await requireSession();
  const alunoId = formText(formData, "aluno_id");
  const responsavelId = formText(formData, "responsavel_id");
  const autorizado = formText(formData, "autorizado") === "true";
  const observacao = formText(formData, "observacao");
  if (!alunoId) redirect(`/alunos?erro=id`);

  const supabase = await createServerClient();
  await supabase.from("consentimentos_biometria").upsert(
    {
      aluno_id: alunoId,
      autorizado,
      responsavel_id: responsavelId,
      data_consentimento: autorizado ? new Date().toISOString() : null,
      data_revogacao: autorizado ? null : new Date().toISOString(),
      observacao
    },
    { onConflict: "aluno_id" }
  );

  if (!autorizado) {
    const { data: bios } = await supabase
      .from("biometrias_aluno")
      .select("id, foto_referencia_path")
      .eq("aluno_id", alunoId)
      .eq("ativo", true);

    for (const bio of bios ?? []) {
      if (bio.foto_referencia_path) {
        await supabase.storage.from("biometrias-alunos").remove([bio.foto_referencia_path]);
      }
      await supabase
        .from("biometrias_aluno")
        .update({
          ativo: false,
          embedding: null,
          embedding_hash: null,
          embedding_encrypted: null,
          foto_referencia_path: null,
          data_revogacao: new Date().toISOString()
        })
        .eq("id", bio.id);
    }
  }

  revalidatePath(`/alunos/${alunoId}/editar`);
}
