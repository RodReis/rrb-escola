"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { processarLembretes } from "@/lib/lembretes/processar";

export async function salvarConfigLembretesAction(formData: FormData) {
  const session = await requirePermission("financeiro.cobrancas", "update");
  const supabase = await createServerClient();

  const autoAtivo = formData.get("auto_ativo") === "on";

  await supabase
    .from("escolas")
    .update({
      lembrete_auto_ativo: autoAtivo,
    })
    .eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/lembretes");
}

export async function enviarLembretesAgoraAction(formData: FormData) {
  const session = await requirePermission("financeiro.cobrancas", "update");

  // Campo "cobranca_ids" = JSON array de ids selecionados. Vazio/ausente = enviar todos.
  let cobrancaIds: string[] | undefined;
  const raw = formData.get("cobranca_ids");
  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cobrancaIds = parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
      }
    } catch {
      cobrancaIds = undefined;
    }
  }

  await processarLembretes({ forcarReenvio: false }, session.profile.escola_id, cobrancaIds);
  revalidatePath("/configuracoes/lembretes");
}
