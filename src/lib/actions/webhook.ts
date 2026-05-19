"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { formText } from "@/lib/utils";

export async function updateWebhookAction(formData: FormData) {
  const session = await requirePermission("configuracoes.webhook", "update");
  const supabase = await createServerClient();

  const url = formText(formData, "webhook_url");
  const ativo = formData.get("webhook_ativo") === "on";

  await supabase
    .from("escolas")
    .update({ webhook_url: url, webhook_ativo: ativo })
    .eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/webhook");
}

export async function testWebhookAction() {
  const session = await requirePermission("configuracoes.webhook", "update");
  const supabase = await createServerClient();

  const { data: escola } = await supabase
    .from("escolas")
    .select("nome, webhook_url")
    .eq("id", session.profile.escola_id)
    .maybeSingle();

  if (!escola?.webhook_url) return;

  try {
    await fetch(escola.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        escola: escola.nome,
        escola_id: session.profile.escola_id,
        emitido_em: new Date().toISOString(),
        tipo: "teste",
        titulo: "Teste de webhook",
        descricao: "Disparo manual de teste",
        severidade: "critico",
        href: null,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // silencioso
  }
}
