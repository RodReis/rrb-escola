import { createServerClient } from "@/lib/supabase/server";

export type DeclaracaoModeloRow = {
  id: string;
  codigo: number;
  nome: string;
  titulo: string;
  texto: string;
  fecho: string;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
};

const SELECT_COLUNAS = "id, codigo, nome, titulo, texto, fecho, ativo, created_at, updated_at";

export async function listarDeclaracaoModelos(opts?: { includeInactive?: boolean }): Promise<DeclaracaoModeloRow[]> {
  const supabase = await createServerClient();
  let query = supabase.from("declaracao_modelos").select(SELECT_COLUNAS).order("nome");
  if (!opts?.includeInactive) query = query.eq("ativo", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DeclaracaoModeloRow[];
}

export async function getDeclaracaoModeloById(id: string): Promise<DeclaracaoModeloRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("declaracao_modelos")
    .select(SELECT_COLUNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as DeclaracaoModeloRow | null) ?? null;
}
