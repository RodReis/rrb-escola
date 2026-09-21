"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { formText } from "@/lib/utils";
import { gravarEventoAuth } from "@/lib/auth/audit";
import type { ActionResult } from "@/lib/actions/types";

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = formText(formData, "email");
  const password = formText(formData, "password");
  if (!email || !password) return { ok: false, error: "Informe email e senha." };

  const supabase = await createServerClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !authData.user) {
    await gravarEventoAuth({ email, evento: "login_falha", detalhe: "credenciais inválidas" });
    return { ok: false, error: "Credenciais inválidas." };
  }

  const { data: perfil } = await supabase
    .from("perfis")
    .select("escola_id, ativo")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!perfil?.ativo) {
    await gravarEventoAuth({
      escola_id: perfil?.escola_id ?? null,
      user_id: authData.user.id,
      email,
      evento: "login_falha",
      detalhe: "perfil inativo",
    });
    await supabase.auth.signOut();
    return { ok: false, error: "Sem perfil ativo. Solicite acesso ao administrador." };
  }

  await gravarEventoAuth({
    escola_id: perfil.escola_id,
    user_id: authData.user.id,
    email,
    evento: "login_ok",
  });
  return { ok: true, data: undefined, redirectTo: "/" };
}

export async function logoutAction() {
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    await gravarEventoAuth({
      user_id: userData.user.id,
      email: userData.user.email ?? null,
      evento: "logout",
    });
  }
  await supabase.auth.signOut();
  redirect("/login");
}
