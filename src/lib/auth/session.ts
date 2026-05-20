// src/lib/auth/session.ts
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import {
  can,
  type Acao,
  type ModuloCodigo,
  type PermissionMap,
} from "@/lib/auth/permissions";

export type SessionProfile = {
  id: string;
  user_id: string;
  escola_id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
};

export type Session = {
  user: { id: string; email: string };
  profile: SessionProfile;
  permissions: PermissionMap;
};

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("perfis")
    .select("id, user_id, escola_id, nome, email, perfil, ativo")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile || !profile.ativo) return null;

  const { data: perms } = await supabase
    .from("role_permissoes")
    .select("modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar")
    .eq("role_codigo", profile.perfil);

  const permissions: PermissionMap = {};
  for (const p of perms ?? []) {
    permissions[p.modulo_codigo as ModuloCodigo] = {
      read: p.pode_ler,
      create: p.pode_criar,
      update: p.pode_editar,
      delete: p.pode_deletar,
    };
  }

  return {
    user: { id: userData.user.id, email: userData.user.email ?? profile.email },
    profile: profile as SessionProfile,
    permissions,
  };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.profile.perfil !== "admin") redirect("/login?erro=perfil");
  return session;
}

export async function requirePerfil(perfis: string[]): Promise<Session> {
  const session = await requireSession();
  if (!perfis.includes(session.profile.perfil)) {
    redirect("/acesso-negado");
  }
  return session;
}

export async function requirePermission(
  modulo: ModuloCodigo,
  acao: Acao,
): Promise<Session> {
  const session = await requireSession();
  if (session.profile.perfil === "admin") return session;
  if (!can(session.permissions, modulo, acao)) redirect("/acesso-negado");
  return session;
}
