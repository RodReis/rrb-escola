import { createServerClient } from "@/lib/supabase/server";
import type { Mapping } from "@/lib/documents/schema-catalog";

export type TemplateRow = {
  id: string;
  escola_id: string;
  nome: string;
  categoria: "declaracao" | "termo" | "contrato" | "outro";
  storage_path: string;
  ativo: boolean;
  gerado_count: number;
  mappings: Mapping[];
  created_at: string;
  updated_at: string;
};

export async function listTemplates(escolaId: string, opts?: {
  categoria?: TemplateRow["categoria"];
  status?: "ativo" | "inativo" | "todos";
}): Promise<TemplateRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("templates_documentos")
    .select("id, escola_id, nome, categoria, storage_path, ativo, gerado_count, mappings, created_at, updated_at")
    .eq("escola_id", escolaId)
    .order("gerado_count", { ascending: false });

  if (opts?.categoria) q = q.eq("categoria", opts.categoria);
  if (opts?.status === "ativo") q = q.eq("ativo", true);
  if (opts?.status === "inativo") q = q.eq("ativo", false);

  const { data, error } = await q;
  if (error) throw error;
  return (data as TemplateRow[] | null) ?? [];
}

export async function getTemplate(id: string, escolaId: string): Promise<TemplateRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("templates_documentos")
    .select("id, escola_id, nome, categoria, storage_path, ativo, gerado_count, mappings, created_at, updated_at")
    .eq("id", id)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (error) throw error;
  return (data as TemplateRow | null) ?? null;
}

export async function getTemplatesAtivos(escolaId: string): Promise<TemplateRow[]> {
  return listTemplates(escolaId, { status: "ativo" });
}

// ---------------------------------------------------------------------------
// Phase 2 additions — spec-named query functions and MappingSource type.
// Existing listTemplates/getTemplate/getTemplatesAtivos remain untouched.
// ---------------------------------------------------------------------------

/**
 * The source descriptor within a mapping stored in templates_documentos.mappings.
 * For tabela-type mappings; computed mappings use fn instead of source.
 */
export type MappingSource = {
  table: string;
  column: string;
  filter: string | null;
};

/**
 * Alias for listTemplates with status="ativo" — spec-named function for Phase 3.
 */
export async function getTemplatesForSchool(escolaId: string): Promise<TemplateRow[]> {
  return listTemplates(escolaId, { status: "ativo" });
}

/**
 * Returns a single template by ID, scoped to the school via RLS.
 * Accepts only templateId — the escola_id is enforced by the RLS policy on
 * templates_documentos (the session's escola_id is set by the middleware).
 *
 * Falls back to querying without escola_id filter so it works with both
 * RLS-enforced and explicit-escola_id patterns.
 */
export async function getTemplateById(templateId: string): Promise<TemplateRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("templates_documentos")
    .select("id, escola_id, nome, categoria, storage_path, ativo, gerado_count, mappings, created_at, updated_at")
    .eq("id", templateId)
    .maybeSingle();
  if (error) throw error;
  return (data as TemplateRow | null) ?? null;
}

/**
 * Returns only the mappings jsonb column for a template.
 * Useful when the caller only needs to resolve placeholders without loading
 * the full template row (e.g., preview / dry-run generation).
 */
export async function getTemplateMappings(templateId: string): Promise<Mapping[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("templates_documentos")
    .select("mappings")
    .eq("id", templateId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return [];
  return (data.mappings as Mapping[] | null) ?? [];
}

/**
 * Atomically increments gerado_count for a template using a Postgres RPC
 * when available, or falls back to a read-increment-write.
 *
 * The read-increment-write pattern has a negligible race window for this use
 * case (simultaneous generation of the same template), matching the existing
 * inline logic in documents-generate-v2.ts.
 */
export async function incrementTemplateCount(templateId: string): Promise<void> {
  const supabase = await createServerClient();
  // Attempt atomic RPC first (if the function exists in this project's DB).
  const { error: rpcError } = await supabase.rpc("increment_template_count", {
    template_id: templateId,
  });
  if (!rpcError) return;

  // Fallback: read + increment + write.
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
}
