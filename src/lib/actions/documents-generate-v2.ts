"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { generateDocxFromBuffer } from "@/lib/documents/generator-v2";
import { resolveMappings, type ResolverContext } from "@/lib/documents/resolver";
import { validateMapping, type Mapping } from "@/lib/documents/schema-catalog";

export async function generateFromTemplateAction(
  matriculaId: string,
  templateId: string,
): Promise<{ ok: boolean; base64?: string; nomeArquivo?: string; error?: string; warning?: string }> {
  // Geração de documento a partir de template — requer leitura de templates.
  const session = await requirePermission("documentos.templates", "read");
  const escolaId = session.profile.escola_id;
  const supabase = await createServerClient();

  // 1) Carrega template (escopo de escola)
  const { data: tpl, error: tplErr } = await supabase
    .from("templates_documentos")
    .select("id, nome, categoria, storage_path, mappings, ativo, escola_id, gerado_count")
    .eq("id", templateId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (tplErr || !tpl) return { ok: false, error: "Template não encontrado." };
  if (!tpl.ativo) return { ok: false, error: "Template inativo." };

  // 2) Carrega matrícula
  const { data: mat, error: matErr } = await supabase
    .from("matriculas")
    .select("aluno_id, ano_letivo")
    .eq("id", matriculaId)
    .maybeSingle();
  if (matErr || !mat) return { ok: false, error: "Matrícula não encontrada." };
  const alunoId = mat.aluno_id as string;

  // 3) Baixa template do Storage
  const { data: dl, error: dlErr } = await supabase
    .storage.from("templates-documentos").download(tpl.storage_path as string);
  if (dlErr || !dl) return { ok: false, error: "Falha ao baixar template." };
  const templateBuffer = Buffer.from(await dl.arrayBuffer());

  // 4) Resolve mappings (validados antes — mas filtramos por segurança)
  const rawMappings = (tpl.mappings as unknown as unknown[]) ?? [];
  const mappings: Mapping[] = rawMappings.filter((m): m is Mapping => validateMapping(m));

  const ctx: ResolverContext = { supabase, matriculaId, alunoId, escolaId };
  const variables = await resolveMappings(mappings, ctx);

  // 5) Gera .docx
  let docxBuffer: Buffer;
  let missingPlaceholders: string[] = [];
  try {
    const result = generateDocxFromBuffer(templateBuffer, variables);
    docxBuffer = result.buffer;
    missingPlaceholders = result.missing;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao gerar docx." };
  }

  // 6) Monta nome de arquivo, faz upload em documentos-alunos, registra
  const nomeAluno = (variables.NOME_ALUNO || "Aluno")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const anoLetivo = variables.ANO_LETIVO || String(new Date().getFullYear());
  const nomeArquivo = `${tpl.nome} - ${nomeAluno} - ${anoLetivo}.docx`.replace(/[/\\:*?"<>|]/g, "-");
  const safeName = nomeArquivo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${alunoId}/${Date.now()}-${safeName}`;
  const contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const { error: upErr } = await supabase.storage
    .from("documentos-alunos")
    .upload(storagePath, docxBuffer, { contentType, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: insErr } = await supabase.from("documentos_aluno").insert({
    aluno_id: alunoId,
    nome_arquivo: nomeArquivo,
    tipo_documento: tpl.categoria,
    storage_path: storagePath,
    content_type: contentType,
    tamanho_bytes: docxBuffer.length,
  });
  if (insErr) {
    await supabase.storage.from("documentos-alunos").remove([storagePath]);
    return { ok: false, error: insErr.message };
  }

  // 7) Incrementa contagem (read+update; perda raríssima sob concorrência é aceitável)
  const { data: cur } = await supabase
    .from("templates_documentos")
    .select("gerado_count")
    .eq("id", templateId)
    .maybeSingle();
  const next = ((cur?.gerado_count as number | null) ?? 0) + 1;
  await supabase
    .from("templates_documentos")
    .update({ gerado_count: next })
    .eq("id", templateId);

  revalidatePath(`/matriculas/${matriculaId}`);
  revalidatePath(`/alunos/${alunoId}`);

  const warning = missingPlaceholders.length > 0
    ? `Atenção: ${missingPlaceholders.length} placeholder(s) sem mapping (${missingPlaceholders.slice(0, 3).join(", ")}${missingPlaceholders.length > 3 ? "…" : ""}). Edite o template em /rh/documentos.`
    : undefined;

  return {
    ok: true,
    base64: docxBuffer.toString("base64"),
    nomeArquivo,
    warning,
  };
}
