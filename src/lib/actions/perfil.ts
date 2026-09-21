"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { formText } from "@/lib/utils";
import { assertOk } from "@/lib/actions/assert-ok";

const IMG_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export async function uploadOwnAvatarAction(formData: FormData) {
  const session = await requireSession();
  const file = formData.get("foto");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/meu-perfil?erro=sem_arquivo");
  }
  if (file.size > 2 * 1024 * 1024) {
    redirect("/meu-perfil?erro=arquivo_grande");
  }
  if (!IMG_TYPES.has(file.type)) {
    redirect("/meu-perfil?erro=tipo_invalido");
  }

  const supabase = await createServerClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${session.profile.id}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { data: uploaded, error: uploadErr } = await supabase.storage
    .from("perfis-fotos")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadErr) redirect(`/meu-perfil?erro=${encodeURIComponent(uploadErr.message)}`);

  await supabase
    .from("perfis")
    .update({ foto_url: uploaded?.path ?? path })
    .eq("id", session.profile.id);

  revalidatePath("/meu-perfil");
  revalidatePath("/", "layout");
  redirect("/meu-perfil?avatar_atualizado=1");
}

export async function removeOwnAvatarAction() {
  const session = await requireSession();
  const supabase = await createServerClient();

  assertOk(
    await supabase.from("perfis").update({ foto_url: null }).eq("id", session.profile.id),
    "Não foi possível remover a foto",
  );

  revalidatePath("/meu-perfil");
  revalidatePath("/", "layout");
  redirect("/meu-perfil?avatar_removido=1");
}

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
