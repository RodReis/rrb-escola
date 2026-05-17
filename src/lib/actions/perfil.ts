"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { formText } from "@/lib/utils";

export async function updateOwnProfileAction(formData: FormData) {
  const session = await requireSession();
  const supabase = await createServerClient();

  const nome = formText(formData, "nome");
  if (!nome) redirect("/meu-perfil?erro=nome");

  await supabase
    .from("perfis")
    .update({ nome })
    .eq("id", session.profile.id);

  revalidatePath("/meu-perfil");
  redirect("/meu-perfil?atualizado=1");
}

export async function changeOwnPasswordAction(formData: FormData) {
  const session = await requireSession();
  const novaSenha = formText(formData, "nova_senha");
  const confirmacao = formText(formData, "confirmacao");

  if (!novaSenha || novaSenha.length < 8) {
    redirect("/meu-perfil?erro=senha_curta");
  }
  if (novaSenha !== confirmacao) {
    redirect("/meu-perfil?erro=senha_nao_bate");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(session.user.id, {
    password: novaSenha,
  });
  if (error) {
    redirect(`/meu-perfil?erro=${encodeURIComponent(error.message)}`);
  }

  redirect("/meu-perfil?senha_alterada=1");
}
