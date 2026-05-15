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
  if (autorizado && !responsavelId) redirect(`/alunos/${alunoId}/editar?erro=responsavel`);

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

type SaveBiometryInput = {
  alunoId: string;
  embedding: number[];
  scoreMedio: number;
  fotoBase64: string;
};

export async function saveBiometryAction(input: SaveBiometryInput) {
  await requireSession();
  if (!input.alunoId) throw new Error("aluno_id requerido");
  if (input.embedding.length !== 128) throw new Error("embedding deve ter 128 dimensoes");

  const supabase = await createServerClient();

  const { data: consent } = await supabase
    .from("consentimentos_biometria")
    .select("autorizado")
    .eq("aluno_id", input.alunoId)
    .maybeSingle();
  if (!consent?.autorizado) throw new Error("consentimento ausente ou revogado");

  const base64Body = input.fotoBase64.replace(/^data:image\/\w+;base64,/, "");
  const fotoBuffer = Buffer.from(base64Body, "base64");
  const path = `${input.alunoId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("biometrias-alunos")
    .upload(path, fotoBuffer, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;

  await supabase
    .from("biometrias_aluno")
    .update({ ativo: false })
    .eq("aluno_id", input.alunoId)
    .eq("ativo", true);

  const vectorLiteral = `[${input.embedding.map((v) => v.toFixed(6)).join(",")}]`;
  const { error: insertError } = await supabase.from("biometrias_aluno").insert({
    aluno_id: input.alunoId,
    modelo: "face-api/ssd-mobilenetv1+facenet-128",
    embedding: vectorLiteral,
    score_qualidade: input.scoreMedio,
    foto_referencia_path: path,
    ativo: true,
    criado_por: "operador-web"
  });
  if (insertError) {
    // cleanup orphan
    await supabase.storage.from("biometrias-alunos").remove([path]);
    throw insertError;
  }

  revalidatePath(`/alunos/${input.alunoId}/editar`);
  return { ok: true };
}
