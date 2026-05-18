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
