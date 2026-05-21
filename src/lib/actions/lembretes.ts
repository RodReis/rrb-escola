"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { formText } from "@/lib/utils";
import { processarLembretes } from "@/lib/lembretes/processar";

export async function salvarConfigLembretesAction(formData: FormData) {
  const session = await requirePermission("financeiro.cobrancas", "update");
  const supabase = await createServerClient();

  const template = formText(formData, "template");
  const autoAtivo = formData.get("auto_ativo") === "on";

  if (!template) {
    throw new Error("O template da mensagem é obrigatório");
  }

  await supabase
    .from("escolas")
    .update({
      lembrete_auto_ativo: autoAtivo,
      lembrete_template: template,
    })
    .eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/lembretes");
}

export async function enviarLembretesAgoraAction() {
  const session = await requirePermission("financeiro.cobrancas", "update");

  // Envio manual: respeita "uma vez por cobrança" (não força reenvio).
  await processarLembretes({ forcarReenvio: false }, session.profile.escola_id);

  revalidatePath("/configuracoes/lembretes");
}
