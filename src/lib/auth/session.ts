import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export type SessionProfile = {
  id: string;
  user_id: string;
  escola_id: string;
  nome: string;
  email: string;
  perfil: "admin" | "secretaria" | "financeiro" | "professor";
  ativo: boolean;
};

export type Session = {
  user: { id: string; email: string };
  profile: SessionProfile;
};

export async function getSession(): Promise<Session | null> {
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("perfis")
    .select("id, user_id, escola_id, nome, email, perfil, ativo")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile || !profile.ativo) return null;
  return {
    user: { id: userData.user.id, email: userData.user.email ?? profile.email },
    profile: profile as SessionProfile
  };
}

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
