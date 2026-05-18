"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { buildVariables } from "@/lib/documents/variables";
import { generateDocx, generateDocumentoPdf } from "@/lib/documents/generator";
import { isTipoTemplate, TEMPLATE_META } from "@/lib/documents/templates";

export async function generateDocxAction(
  matriculaId: string,
  tipoTemplateRaw: string
): Promise<{ success: boolean; base64?: string; nomeArquivo?: string; error?: string }> {
  await requireSession();

  if (!isTipoTemplate(tipoTemplateRaw)) {
    return { success: false, error: "Tipo de template inválido." };
  }

  const supabase = await createServerClient();

  const { data: matricula, error: matError } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .eq("id", matriculaId)
    .single();

  if (matError || !matricula) {
    return { success: false, error: "Matrícula não encontrada." };
  }

  const alunoId = matricula.aluno_id as string;

  try {
    const variables = await buildVariables(matriculaId);
    const meta = TEMPLATE_META[tipoTemplateRaw];
    const docxBuffer = generateDocx(tipoTemplateRaw, variables);

    const nomeAluno = (variables.NOME_ALUNO || "Aluno")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    const anoLetivo = variables.ANO_LETIVO || String(new Date().getFullYear());
    const nomeArquivo = `${meta.label} - ${nomeAluno} - ${anoLetivo}.docx`
      .replace(/[/\\:*?"<>|]/g, "-");

    const safeName = nomeArquivo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${alunoId}/${Date.now()}-${safeName}`;
    const contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const { error: uploadError } = await supabase.storage
      .from("documentos-alunos")
      .upload(storagePath, docxBuffer, { contentType, upsert: false });

    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from("documentos_aluno").insert({
      aluno_id: alunoId,
      nome_arquivo: nomeArquivo,
      tipo_documento: meta.tipoDocumento,
      storage_path: storagePath,
      content_type: contentType,
      tamanho_bytes: docxBuffer.length,
    });

    if (insertError) {
      await supabase.storage.from("documentos-alunos").remove([storagePath]);
      throw insertError;
    }

    revalidatePath(`/matriculas/${matriculaId}`);
    revalidatePath(`/alunos/${alunoId}`);

    return {
      success: true,
      base64: docxBuffer.toString("base64"),
      nomeArquivo,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar documento.";
    return { success: false, error: msg };
  }
}

export async function generateDocumentoAction(
  matriculaId: string,
  tipoTemplateRaw: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  await requireSession();

  if (!isTipoTemplate(tipoTemplateRaw)) {
    return { success: false, error: "Tipo de template inválido." };
  }

  const supabase = await createServerClient();

  const { data: matricula, error: matError } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .eq("id", matriculaId)
    .single();

  if (matError || !matricula) {
    return { success: false, error: "Matrícula não encontrada." };
  }

  const alunoId = matricula.aluno_id as string;

  try {
    const variables = await buildVariables(matriculaId);
    const { pdfBuffer, nomeArquivo } = await generateDocumentoPdf(tipoTemplateRaw, variables);

    const safeName = nomeArquivo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${alunoId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos-alunos")
      .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) throw uploadError;

    const meta = TEMPLATE_META[tipoTemplateRaw];

    const { error: insertError } = await supabase.from("documentos_aluno").insert({
      aluno_id: alunoId,
      nome_arquivo: nomeArquivo,
      tipo_documento: meta.tipoDocumento,
      storage_path: storagePath,
      content_type: "application/pdf",
      tamanho_bytes: pdfBuffer.length,
    });

    if (insertError) {
      await supabase.storage.from("documentos-alunos").remove([storagePath]);
      throw insertError;
    }

    const { data: signed } = await supabase.storage
      .from("documentos-alunos")
      .createSignedUrl(storagePath, 60 * 30);

    revalidatePath(`/matriculas/${matriculaId}`);
    revalidatePath(`/alunos/${alunoId}`);

    return { success: true, url: signed?.signedUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar documento.";
    return { success: false, error: msg };
  }
}
