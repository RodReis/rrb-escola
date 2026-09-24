// src/lib/actions/declaracoes.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { DeclaracaoModeloSchema, DeclaracaoModeloUpdateSchema } from "@/lib/validation/declaracoes";

function firstError(error: { issues: { message: string }[] }) {
  return encodeURIComponent(error.issues[0]?.message ?? "Dados inválidos");
}

function readForm(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    titulo: String(formData.get("titulo") ?? "").trim(),
    texto: String(formData.get("texto") ?? "").trim(),
    fecho: String(formData.get("fecho") ?? "").trim()
  };
}

export async function createDeclaracaoModeloAction(formData: FormData) {
  const session = await requirePermission("historico", "create");

  const parsed = DeclaracaoModeloSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    redirect(`/declaracoes/modelos/novo?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("declaracao_modelos").insert({
    escola_id: session.profile.escola_id,
    nome: parsed.data.nome,
    titulo: parsed.data.titulo,
    texto: parsed.data.texto,
    fecho: parsed.data.fecho
  });

  if (error) redirect(`/declaracoes/modelos/novo?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/declaracoes/modelos");
  redirect("/declaracoes/modelos?ok=criado");
}

export async function updateDeclaracaoModeloAction(formData: FormData) {
  await requirePermission("historico", "update");

  const id = String(formData.get("id") ?? "");
  const parsed = DeclaracaoModeloUpdateSchema.safeParse({
    id,
    ...readForm(formData),
    ativo: formData.get("ativo")
  });
  if (!parsed.success) {
    redirect(`/declaracoes/modelos/${id}/editar?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("declaracao_modelos")
    .update({
      nome: parsed.data.nome,
      titulo: parsed.data.titulo,
      texto: parsed.data.texto,
      fecho: parsed.data.fecho,
      ativo: parsed.data.ativo
    })
    .eq("id", parsed.data.id);

  if (error) redirect(`/declaracoes/modelos/${parsed.data.id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/declaracoes/modelos");
  redirect("/declaracoes/modelos?ok=editado");
}

export async function toggleDeclaracaoModeloAction(formData: FormData) {
  await requirePermission("historico", "update");
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "on";

  if (!id) redirect("/declaracoes/modelos?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("declaracao_modelos").update({ ativo }).eq("id", id);
  if (error) redirect(`/declaracoes/modelos?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/declaracoes/modelos");
  redirect(`/declaracoes/modelos?ok=${ativo ? "ativado" : "desativado"}`);
}

export async function deleteDeclaracaoModeloAction(formData: FormData) {
  await requirePermission("historico", "delete");
  const id = String(formData.get("id") ?? "");

  if (!id) redirect("/declaracoes/modelos?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("declaracao_modelos").delete().eq("id", id);
  if (error) redirect(`/declaracoes/modelos?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/declaracoes/modelos");
  redirect("/declaracoes/modelos?ok=excluído");
}
