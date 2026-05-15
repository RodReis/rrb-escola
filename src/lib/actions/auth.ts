"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formText } from "@/lib/utils";

export async function ensureDefaultAdmin() {
  const email = process.env.APP_DEFAULT_ADMIN_EMAIL ?? "admin@rrbescola.local";
  const password = process.env.APP_DEFAULT_ADMIN_PASSWORD ?? "rrb123456";
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) return;

  let user = data.users.find((item) => item.email === email);
  if (!user) {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: "Administrador RRB Escola" }
    });
    user = created.data.user ?? undefined;
  }

  if (user) {
    await supabase.from("perfis").upsert(
      {
        user_id: user.id,
        escola_id: DEFAULT_SCHOOL_ID,
        nome: "Administrador RRB Escola",
        email,
        perfil: "admin",
        ativo: true
      },
      { onConflict: "user_id" }
    );
  }
}

export async function loginAction(formData: FormData) {
  const email = formText(formData, "email");
  const password = formText(formData, "password");
  if (!email || !password) redirect("/login?erro=credenciais");

  const supabase = createPublicClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?erro=auth");

  redirect("/");
}

export async function logoutAction() {
  const supabase = createPublicClient();
  await supabase.auth.signOut();

  redirect("/login");
}
