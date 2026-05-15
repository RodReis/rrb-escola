"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { formText } from "@/lib/utils";

export async function uploadStudentDocumentAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const tipoDocumento = formText(formData, "tipo_documento") ?? "outro";
  const file = formData.get("documento");

  if (!alunoId || !(file instanceof File) || file.size === 0) return;

  const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) throw new Error("Envie PDF, JPG, PNG ou WEBP.");

  const supabase = createAdminClient();
  const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${alunoId}/${Date.now()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from("documentos-alunos").upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("documentos_aluno").insert({
    aluno_id: alunoId,
    nome_arquivo: file.name,
    tipo_documento: tipoDocumento,
    storage_path: storagePath,
    content_type: file.type,
    tamanho_bytes: file.size
  });

  if (insertError) throw insertError;

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function removeStudentDocumentAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const documentoId = formText(formData, "documento_id");
  const storagePath = formText(formData, "storage_path");
  if (!alunoId || !documentoId || !storagePath) return;

  const supabase = createAdminClient();
  await supabase.storage.from("documentos-alunos").remove([storagePath]);
  await supabase.from("documentos_aluno").delete().eq("id", documentoId).eq("aluno_id", alunoId);

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}
