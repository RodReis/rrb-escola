"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { formText } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const email = formText(formData, "email");
  const password = formText(formData, "password");
  if (!email || !password) redirect("/login?erro=credenciais");

  const supabase = await createServerClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !authData.user) redirect("/login?erro=auth");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("ativo")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!perfil?.ativo) {
    await supabase.auth.signOut();
    redirect("/login?erro=perfil");
  }
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
