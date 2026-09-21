"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { gravarEventoAuth } from "@/lib/auth/audit";
import { formText } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/types";
import {
  sendEmail,
  renderPasswordResetEmail,
  renderUserCreatedEmail,
} from "@/lib/email/resend";

/** Dados exibidos uma unica vez no modal de credencial (criar/resetar senha). */
export type CredencialGerada = { email: string; senha: string; emailEnviado: boolean };

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}

async function readPerfil(formData: FormData, escolaId: string): Promise<string> {
  const raw = formText(formData, "perfil");
  if (!raw) return "admin";
  const admin = createAdminClient();
  const { data } = await admin
    .from("roles")
    .select("codigo")
    .or(`escola_id.is.null,escola_id.eq.${escolaId}`)
    .eq("codigo", raw)
    .maybeSingle();
  if (data) return data.codigo;
  return "admin";
}

function generatePassword() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function createUserAction(
  formData: FormData
): Promise<ActionResult<CredencialGerada>> {
  const session = await requirePermission("usuarios", "create");
  const email = formText(formData, "email");
  const nome = formText(formData, "nome");
  if (!email || !nome) {
    return { ok: false, error: "Preencha todos os campos obrigatórios." };
  }

  const perfil = await readPerfil(formData, session.profile.escola_id);
  const password = generatePassword();
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error || !created.user) return { ok: false, error: "Falha ao criar o acesso." };

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
    return { ok: false, error: "Falha ao salvar o perfil." };
  }

  const emailResult = await sendEmail({
    to: email,
    subject: "CRM Escola — Sua conta foi criada",
    html: renderUserCreatedEmail({ nome, email, password, appUrl: getAppUrl() }),
  });
  if (!emailResult.ok) {
    console.warn(`[users] email send fail (createUser ${email}): ${emailResult.reason}`);
  }

  revalidatePath("/usuarios");
  // Sem redirectTo de proposito: a navegacao so deve acontecer depois que o
  // usuario ve e fecha o modal com a senha gerada (NovoUsuarioForm cuida
  // disso via onSuccess + router.push manual).
  return {
    ok: true,
    data: { email, senha: password, emailEnviado: emailResult.ok },
  };
}

export async function updateUserAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("usuarios", "update");
  const perfilId = formText(formData, "perfilId");
  const nome = formText(formData, "nome");
  if (!perfilId || !nome) {
    return { ok: false, error: "Preencha todos os campos obrigatórios." };
  }

  const perfil = await readPerfil(formData, session.profile.escola_id);
  const admin = createAdminClient();

  const { error } = await admin
    .from("perfis")
    .update({ nome, perfil })
    .eq("id", perfilId);
  if (error) return { ok: false, error: "Falha ao salvar o perfil." };

  revalidatePath("/usuarios");
  return { ok: true, data: undefined, redirectTo: "/usuarios" };
}

export async function deactivateUserAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("usuarios", "update");
  const perfilId = formText(formData, "perfilId");
  if (!perfilId) return { ok: false, error: "Usuário não informado." };
  if (perfilId === session.profile.id) {
    return { ok: false, error: "Você não pode desativar o próprio usuário." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("perfis")
    .update({ ativo: false })
    .eq("id", perfilId);
  if (error) return { ok: false, error: "Falha ao desativar o usuário." };

  await gravarEventoAuth({
    escola_id: session.profile.escola_id,
    user_id: session.profile.user_id,
    email: session.profile.email,
    evento: "dado_excluido",
    recurso: "perfis",
    recurso_id: perfilId,
    detalhe: "usuário desativado",
  });

  revalidatePath("/usuarios");
  return { ok: true, data: undefined };
}

export async function reactivateUserAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("usuarios", "update");
  const perfilId = formText(formData, "perfilId");
  if (!perfilId) return { ok: false, error: "Usuário não informado." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("perfis")
    .update({ ativo: true })
    .eq("id", perfilId);
  if (error) return { ok: false, error: "Falha ao reativar o usuário." };

  revalidatePath("/usuarios");
  return { ok: true, data: undefined };
}

export async function resetPasswordAction(
  formData: FormData
): Promise<ActionResult<CredencialGerada>> {
  const session = await requirePermission("usuarios", "update");
  const perfilId = formText(formData, "perfilId");
  if (!perfilId) return { ok: false, error: "Usuário não informado." };

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("perfis")
    .select("user_id, email")
    .eq("id", perfilId)
    .maybeSingle();
  if (!perfil?.user_id) return { ok: false, error: "Usuário não encontrado." };

  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(perfil.user_id, { password });
  if (error) return { ok: false, error: error.message };

  await gravarEventoAuth({
    escola_id: session.profile.escola_id,
    user_id: perfil.user_id,
    email: perfil.email,
    evento: "senha_alterada",
    recurso: "perfis",
    recurso_id: perfilId,
    detalhe: `redefinida por ${session.profile.email}`,
  });

  const { data: perfilFull } = await admin
    .from("perfis")
    .select("nome")
    .eq("id", perfilId)
    .maybeSingle();

  const emailResult = await sendEmail({
    to: perfil.email,
    subject: "CRM Escola — Sua senha foi redefinida",
    html: renderPasswordResetEmail({
      nome: perfilFull?.nome ?? perfil.email,
      email: perfil.email,
      password,
      appUrl: getAppUrl(),
    }),
  });
  if (!emailResult.ok) {
    console.warn(`[users] email send fail (resetPassword ${perfil.email}): ${emailResult.reason}`);
  }

  revalidatePath("/usuarios");
  return {
    ok: true,
    data: { email: perfil.email, senha: password, emailEnviado: emailResult.ok },
  };
}
