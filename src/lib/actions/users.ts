"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin"; // service role: supabase.auth.admin.createUser requer
import { formText } from "@/lib/utils";

function generatePassword() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function createUserAction(formData: FormData) {
  const session = await requireAdmin();
  const email = formText(formData, "email");
  const nome = formText(formData, "nome");
  if (!email || !nome) redirect("/usuarios/novo?erro=campos");

  const password = generatePassword();
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome }
  });
  if (error || !created.user) redirect(`/usuarios/novo?erro=auth`);

  const { error: perfilError } = await admin.from("perfis").insert({
    user_id: created.user.id,
    escola_id: session.profile.escola_id,
    nome,
    email,
    perfil: "admin",
    ativo: true
  });
  if (perfilError) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect(`/usuarios/novo?erro=perfil`);
  }

  revalidatePath("/usuarios");
  redirect(`/usuarios?criado=${encodeURIComponent(email)}&senha=${encodeURIComponent(password)}`);
}

export async function deactivateUserAction(formData: FormData) {
  await requireAdmin();
  const perfilId = formText(formData, "perfilId");
  if (!perfilId) redirect("/usuarios?erro=id");

  const admin = createAdminClient(); // service role: atualização de perfil admin
  const { error } = await admin
    .from("perfis")
    .update({ ativo: false })
    .eq("id", perfilId);
  if (error) redirect("/usuarios?erro=desativar");

  revalidatePath("/usuarios");
  redirect("/usuarios?desativado=1");
}
