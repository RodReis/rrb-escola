"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { formText } from "@/lib/utils";

const IMG_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export async function uploadEscolaLogoAction(formData: FormData) {
  const session = await requirePermission("configuracoes.escola", "update");
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/configuracoes/escola?erro=sem_arquivo");
  }
  if (file.size > 2 * 1024 * 1024) {
    redirect("/configuracoes/escola?erro=arquivo_grande");
  }
  if (!IMG_TYPES.has(file.type)) {
    redirect("/configuracoes/escola?erro=tipo_invalido");
  }

  const supabase = await createServerClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${session.profile.escola_id}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { data: uploaded, error: uploadErr } = await supabase.storage
    .from("escola-logos")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadErr) redirect(`/configuracoes/escola?erro=${encodeURIComponent(uploadErr.message)}`);

  await supabase
    .from("escolas")
    .update({ logo_url: uploaded?.path ?? path })
    .eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/escola");
  revalidatePath("/", "layout");
  redirect("/configuracoes/escola?logo_atualizada=1");
}

export async function removeEscolaLogoAction() {
  const session = await requirePermission("configuracoes.escola", "update");
  const supabase = await createServerClient();

  await supabase.from("escolas").update({ logo_url: null }).eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/escola");
  revalidatePath("/", "layout");
  redirect("/configuracoes/escola?logo_removida=1");
}

export async function updateEscolaAction(formData: FormData) {
  const session = await requirePermission("configuracoes.escola", "update");
  const supabase = await createServerClient();

  await supabase
    .from("escolas")
    .update({
      nome: formText(formData, "nome") ?? "",
      cnpj: formText(formData, "cnpj"),
      telefone: formText(formData, "telefone"),
      email: formText(formData, "email"),
      endereco: formText(formData, "endereco"),
      cidade: formText(formData, "cidade"),
      uf: formText(formData, "uf"),
      cep: formText(formData, "cep"),
    })
    .eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/escola");
  redirect("/configuracoes/escola?salvo=1");
}
