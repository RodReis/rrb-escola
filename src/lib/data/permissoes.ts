// src/lib/data/permissoes.ts
import { createServerClient } from "@/lib/supabase/server";
import type { Acao, ModuloCodigo } from "@/lib/auth/permissions";

export type Role = {
  codigo: string;
  nome: string;
  descricao: string | null;
  sistema: boolean;
  escola_id: string | null;
  created_at: string;
};

export type RolePermissao = {
  modulo_codigo: ModuloCodigo;
  pode_ler: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_deletar: boolean;
};

export async function listRoles(escolaId: string): Promise<Array<Role & { usuarios: number }>> {
  const supabase = await createServerClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("codigo, nome, descricao, sistema, escola_id, created_at")
    .or(`escola_id.is.null,escola_id.eq.${escolaId}`)
    .order("sistema", { ascending: false })
    .order("nome");

  const { data: counts } = await supabase
    .from("perfis")
    .select("perfil")
    .eq("escola_id", escolaId);

  const tally: Record<string, number> = {};
  for (const c of counts ?? []) tally[c.perfil] = (tally[c.perfil] ?? 0) + 1;

  return (roles ?? []).map((r) => ({ ...(r as Role), usuarios: tally[r.codigo] ?? 0 }));
}

export async function getRole(codigo: string): Promise<Role | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("roles")
    .select("codigo, nome, descricao, sistema, escola_id, created_at")
    .eq("codigo", codigo)
    .maybeSingle();
  return (data as Role) ?? null;
}

export async function getRolePermissoes(codigo: string): Promise<RolePermissao[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("role_permissoes")
    .select("modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar")
    .eq("role_codigo", codigo);
  return (data as RolePermissao[]) ?? [];
}

export function permissoesToMap(perms: RolePermissao[]): Record<ModuloCodigo, Record<Acao, boolean>> {
  const map = {} as Record<ModuloCodigo, Record<Acao, boolean>>;
  for (const p of perms) {
    map[p.modulo_codigo] = {
      read: p.pode_ler,
      create: p.pode_criar,
      update: p.pode_editar,
      delete: p.pode_deletar,
    };
  }
  return map;
}
