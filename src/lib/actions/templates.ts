"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { extractPlaceholders } from "@/lib/documents/placeholders";
import { validateMapping, inferDefaultMapping, type Mapping } from "@/lib/documents/schema-catalog";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 5 * 1024 * 1024;
const VALID_CATEGORIAS = new Set(["declaracao", "termo", "contrato", "outro"]);

function sanitizeNome(nome: string): string {
  return nome.trim().slice(0, 120);
}

export async function uploadTemplateAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;

  const file = formData.get("arquivo");
  const nomeRaw = String(formData.get("nome") ?? "");
  const categoria = String(formData.get("categoria") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Arquivo .docx obrigatório.");
  }
  if (file.size > MAX_BYTES) throw new Error("Arquivo maior que 5 MB.");
  if (file.type !== DOCX_MIME && !file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Envie um arquivo .docx.");
  }
  if (sanitizeNome(nomeRaw).length < 3) throw new Error("Nome do template precisa ter pelo menos 3 caracteres.");
  if (!VALID_CATEGORIAS.has(categoria)) throw new Error("Categoria inválida.");

  const supabase = await createServerClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse antes do upload — se falhar, abortamos.
  let placeholders: string[] = [];
  try {
    placeholders = extractPlaceholders(buffer);
  } catch {
    throw new Error("Falha ao ler o arquivo .docx. Verifique se está válido.");
  }

  const templateId = randomUUID();
  const storagePath = `${escolaId}/templates/${templateId}.docx`;

  const { error: upErr } = await supabase.storage
    .from("templates-documentos")
    .upload(storagePath, buffer, { contentType: DOCX_MIME, upsert: false });
  if (upErr) throw upErr;

  const initialMappings: Mapping[] = placeholders.map((p) => inferDefaultMapping(p));

  const { error: insErr } = await supabase.from("templates_documentos").insert({
    id: templateId,
    escola_id: escolaId,
    nome: sanitizeNome(nomeRaw),
    categoria,
    storage_path: storagePath,
    ativo: false, // só ativa depois do mapeamento
    mappings: initialMappings,
  });
  if (insErr) {
    await supabase.storage.from("templates-documentos").remove([storagePath]);
    throw insErr;
  }

  revalidatePath("/rh/documentos");
  redirect(`/rh/documentos/${templateId}/mapeamento`);
}

export async function saveTemplateMappingsAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const templateId = String(formData.get("template_id") ?? "");
  const mappingsJson = String(formData.get("mappings") ?? "[]");
  const ativarRaw = String(formData.get("ativar") ?? "");

  if (!templateId) throw new Error("template_id obrigatório.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(mappingsJson);
  } catch {
    throw new Error("Mappings JSON inválido.");
  }
  if (!Array.isArray(parsed)) throw new Error("Mappings precisa ser array.");
  for (const m of parsed) {
    if (!validateMapping(m)) throw new Error(`Mapping inválido: ${JSON.stringify(m)}`);
  }
  const mappings = parsed as Mapping[];

  const supabase = await createServerClient();
  const update: Record<string, unknown> = {
    mappings,
    updated_at: new Date().toISOString(),
  };
  if (ativarRaw === "1") update.ativo = true;

  const { error } = await supabase
    .from("templates_documentos")
    .update(update)
    .eq("id", templateId)
    .eq("escola_id", escolaId);
  if (error) throw error;

  revalidatePath("/rh/documentos");
  revalidatePath(`/rh/documentos/${templateId}`);
  revalidatePath(`/rh/documentos/${templateId}/mapeamento`);
  redirect("/rh/documentos");
}

export async function updateTemplateAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const templateId = String(formData.get("template_id") ?? "");
  const nome = sanitizeNome(String(formData.get("nome") ?? ""));
  const categoria = String(formData.get("categoria") ?? "");

  if (!templateId) throw new Error("template_id obrigatório.");
  if (nome.length < 3) throw new Error("Nome inválido.");
  if (!VALID_CATEGORIAS.has(categoria)) throw new Error("Categoria inválida.");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("templates_documentos")
    .update({ nome, categoria, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("escola_id", escolaId);
  if (error) throw error;

  revalidatePath("/rh/documentos");
  revalidatePath(`/rh/documentos/${templateId}`);
}

export async function toggleTemplateAtivoAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const templateId = String(formData.get("template_id") ?? "");
  const ativo = String(formData.get("ativo") ?? "") === "1";
  if (!templateId) throw new Error("template_id obrigatório.");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("templates_documentos")
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("escola_id", escolaId);
  if (error) throw error;

  revalidatePath("/rh/documentos");
}

export async function deleteTemplateAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const templateId = String(formData.get("template_id") ?? "");
  if (!templateId) throw new Error("template_id obrigatório.");

  const supabase = await createServerClient();
  const { data: tpl } = await supabase
    .from("templates_documentos")
    .select("id, escola_id, storage_path, gerado_count")
    .eq("id", templateId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (!tpl) throw new Error("Template não encontrado.");
  if ((tpl.gerado_count ?? 0) > 0) {
    throw new Error("Template já gerou documentos. Use Desativar em vez de Excluir.");
  }

  await supabase.storage.from("templates-documentos").remove([tpl.storage_path]);
  const { error } = await supabase
    .from("templates_documentos")
    .delete()
    .eq("id", templateId)
    .eq("escola_id", escolaId);
  if (error) throw error;

  revalidatePath("/rh/documentos");
  redirect("/rh/documentos");
}
