// Dispara webhook externo (Make/Zapier/N8N) quando notificacao critica e criada.
// Chamado fire-and-forget. Erros silenciosos para nao quebrar fluxo.

import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

type NotifPayload = {
  tipo: string;
  titulo: string;
  descricao: string | null;
  href: string | null;
  severidade: string;
};

export async function dispatchWebhook(
  notif: NotifPayload,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<void> {
  // So envia se severidade for critica (regra de produto)
  if (notif.severidade !== "critico") return;

  const supabase = await createServerClient();
  const { data: escola } = await supabase
    .from("escolas")
    .select("nome, webhook_url, webhook_ativo")
    .eq("id", escolaId)
    .maybeSingle();

  if (!escola?.webhook_ativo || !escola.webhook_url) return;

  try {
    await fetch(escola.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        escola: escola.nome,
        escola_id: escolaId,
        emitido_em: new Date().toISOString(),
        ...notif,
      }),
      // timeout curto - nao bloquear
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // silencioso
  }
}
