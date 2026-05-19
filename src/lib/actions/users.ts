"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { setUserCreatedFlash } from "@/lib/actions/user-flash";
import { formText } from "@/lib/utils";

const PERFIS = ["admin", "secretaria", "financeiro", "professor"] as const;
type PerfilTipo = (typeof PERFIS)[number];

function readPerfil(formData: FormData): PerfilTipo {
  const raw = formText(formData, "perfil");
  if (raw && (PERFIS as readonly string[]).includes(raw)) return raw as PerfilTipo;
  return "admin";
}

function generatePassword() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function createUserAction(formData: FormData) {
  const session = await requirePermission("usuarios", "create");
  const email = formText(formData, "email");
  const nome = formText(formData, "nome");
  if (!email || !nome) redirect("/usuarios/novo?erro=campos");

  const perfil = readPerfil(formData);
  const password = generatePassword();
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error || !created.user) redirect(`/usuarios/novo?erro=auth`);

  const { error: perfilError } = await admin.from("perfis").insert({
    user_id: created.user.id,
    escola_id: session.profile.escola_id,
    nome,
    email,
    perfil,
    ativo: true,
  });
  if (perfilError) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect(`/usuarios/novo?erro=perfil`);
  }

  setUserCreatedFlash(email, password);
  revalidatePath("/usuarios");
  redirect("/usuarios?criado=1");
}

export async function updateUserAction(formData: FormData) {
  await requirePermission("usuarios", "update");
  const perfilId = formText(formData, "perfilId");
  const nome = formText(formData, "nome");
  if (!perfilId || !nome) redirect(`/usuarios?erro=campos`);

  const perfil = readPerfil(formData);
  const admin = createAdminClient();

  const { error } = await admin
    .from("perfis")
    .update({ nome, perfil })
    .eq("id", perfilId);
  if (error) redirect(`/usuarios/${perfilId}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/usuarios");
  redirect("/usuarios?atualizado=1");
}

export async function deactivateUserAction(formData: FormData) {
  const session = await requirePermission("usuarios", "update");
  const perfilId = formText(formData, "perfilId");
  if (!perfilId) redirect("/usuarios?erro=id");
  if (perfilId === session.profile.id) redirect("/usuarios?erro=self");

  const admin = createAdminClient();
  const { error } = await admin
    .from("perfis")
    .update({ ativo: false })
    .eq("id", perfilId);
  if (error) redirect("/usuarios?erro=desativar");

  revalidatePath("/usuarios");
  redirect("/usuarios?desativado=1");
}

export async function reactivateUserAction(formData: FormData) {
  await requirePermission("usuarios", "update");
  const perfilId = formText(formData, "perfilId");
  if (!perfilId) redirect("/usuarios?erro=id");

  const admin = createAdminClient();
  const { error } = await admin
    .from("perfis")
    .update({ ativo: true })
    .eq("id", perfilId);
  if (error) redirect("/usuarios?erro=reativar");

  revalidatePath("/usuarios");
  redirect("/usuarios?reativado=1");
}

export async function resetPasswordAction(formData: FormData) {
  await requirePermission("usuarios", "update");
  const perfilId = formText(formData, "perfilId");
  if (!perfilId) redirect("/usuarios?erro=id");

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("perfis")
    .select("user_id, email")
    .eq("id", perfilId)
    .maybeSingle();
  if (!perfil?.user_id) redirect("/usuarios?erro=notfound");

  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(perfil.user_id, { password });
  if (error) redirect(`/usuarios?erro=${encodeURIComponent(error.message)}`);

  setUserCreatedFlash(perfil.email, password);
  revalidatePath("/usuarios");
  redirect("/usuarios?senha=1");
}
