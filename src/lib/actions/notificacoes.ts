"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formText } from "@/lib/utils";

export async function markNotificacaoLidaAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();
  const id = formText(formData, "id");
  if (!id) return;

  await supabase
    .from("notificacoes")
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/");
}

export async function markAllNotificacoesLidasAction() {
  const session = await requireSession();
  const supabase = await createServerClient();
  const perfilId = session.profile.id;

  await supabase
    .from("notificacoes")
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .or(`perfil_id.eq.${perfilId},perfil_id.is.null`)
    .eq("lida", false);

  revalidatePath("/");
}
