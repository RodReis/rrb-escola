// src/lib/actions/roles.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULO_CODIGOS } from "@/lib/auth/permissions";
import { formText } from "@/lib/utils";

const CODIGO_RE = /^[a-z][a-z0-9_-]*$/;

export async function createRoleAction(formData: FormData) {
  const session = await requireAdmin();
  const codigo = formText(formData, "codigo");
  const nome = formText(formData, "nome");
  const descricao = formText(formData, "descricao") || null;

  if (!codigo || !nome) redirect("/configuracoes/perfis/nova?erro=campos");
  if (!CODIGO_RE.test(codigo)) redirect("/configuracoes/perfis/nova?erro=codigo");

  const admin = createAdminClient();
  const { error: roleError } = await admin.from("roles").insert({
    codigo,
    nome,
    descricao,
    sistema: false,
    escola_id: session.profile.escola_id,
  });
  if (roleError) {
    redirect(`/configuracoes/perfis/nova?erro=${encodeURIComponent(roleError.message)}`);
  }

  const rows = MODULO_CODIGOS.map((m) => ({
    role_codigo: codigo,
    modulo_codigo: m,
    pode_ler: false,
    pode_criar: false,
    pode_editar: false,
    pode_deletar: false,
  }));
  await admin.from("role_permissoes").insert(rows);

  revalidatePath("/configuracoes/perfis");
  redirect(`/configuracoes/perfis/${codigo}`);
}

export async function updateRoleAction(formData: FormData) {
  await requireAdmin();
  const codigo = formText(formData, "codigo");
  const nome = formText(formData, "nome");
  const descricao = formText(formData, "descricao") || null;
  if (!codigo || !nome) redirect(`/configuracoes/perfis/${codigo}?erro=campos`);

  const admin = createAdminClient();
  const { data: role } = await admin.from("roles").select("sistema").eq("codigo", codigo).maybeSingle();
  if (!role) redirect("/configuracoes/perfis?erro=notfound");

  const { error } = await admin
    .from("roles")
    .update({ nome, descricao, updated_at: new Date().toISOString() })
    .eq("codigo", codigo);
  if (error) redirect(`/configuracoes/perfis/${codigo}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/configuracoes/perfis");
  revalidatePath(`/configuracoes/perfis/${codigo}`);
  redirect(`/configuracoes/perfis/${codigo}?atualizado=1`);
}

export async function deleteRoleAction(formData: FormData) {
  await requireAdmin();
  const codigo = formText(formData, "codigo");
  if (!codigo) redirect("/configuracoes/perfis?erro=id");

  const admin = createAdminClient();
  const { data: role } = await admin.from("roles").select("sistema").eq("codigo", codigo).maybeSingle();
  if (!role) redirect("/configuracoes/perfis?erro=notfound");
  if (role.sistema) redirect("/configuracoes/perfis?erro=sistema");

  const { count } = await admin
    .from("perfis")
    .select("id", { count: "exact", head: true })
    .eq("perfil", codigo);
  if ((count ?? 0) > 0) redirect("/configuracoes/perfis?erro=emuso");

  const { error } = await admin.from("roles").delete().eq("codigo", codigo);
  if (error) redirect(`/configuracoes/perfis?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/configuracoes/perfis");
  redirect("/configuracoes/perfis?excluido=1");
}

export async function updateRolePermissionsAction(formData: FormData) {
  await requireAdmin();
  const codigo = formText(formData, "codigo");
  if (!codigo) redirect("/configuracoes/perfis?erro=id");
  if (codigo === "admin") redirect(`/configuracoes/perfis/${codigo}?erro=adminreadonly`);

  const rows: Array<{
    role_codigo: string;
    modulo_codigo: string;
    pode_ler: boolean;
    pode_criar: boolean;
    pode_editar: boolean;
    pode_deletar: boolean;
  }> = [];
  for (const modulo of MODULO_CODIGOS) {
    rows.push({
      role_codigo: codigo,
      modulo_codigo: modulo,
      pode_ler: formData.get(`perm.${modulo}.read`) === "on",
      pode_criar: formData.get(`perm.${modulo}.create`) === "on",
      pode_editar: formData.get(`perm.${modulo}.update`) === "on",
      pode_deletar: formData.get(`perm.${modulo}.delete`) === "on",
    });
  }

  const admin = createAdminClient();
  await admin.from("role_permissoes").delete().eq("role_codigo", codigo);
  const { error } = await admin.from("role_permissoes").insert(rows);
  if (error) redirect(`/configuracoes/perfis/${codigo}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/configuracoes/perfis");
  revalidatePath(`/configuracoes/perfis/${codigo}`);
  redirect(`/configuracoes/perfis/${codigo}?salvo=1`);
}
