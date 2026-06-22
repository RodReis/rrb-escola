"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { formText } from "@/lib/utils";
import { gravarEventoAuth } from "@/lib/auth/audit";

export async function loginAction(formData: FormData) {
  const email = formText(formData, "email");
  const password = formText(formData, "password");
  if (!email || !password) redirect("/login?erro=credenciais");

  const supabase = await createServerClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !authData.user) {
    await gravarEventoAuth({ email, evento: "login_falha", detalhe: "credenciais inválidas" });
    redirect("/login?erro=auth");
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
    redirect("/login?erro=perfil");
  }

  await gravarEventoAuth({
    escola_id: perfil.escola_id,
    user_id: authData.user.id,
    email,
    evento: "login_ok",
  });
  redirect("/");
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
