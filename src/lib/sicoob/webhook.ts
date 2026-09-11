import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarPixRecebido } from "@/lib/sicoob/pix";

type PixItem = {
  endToEndId?: string;
  e2eId?: string;
  txid?: string;
  valor?: string | number;
  horario?: string;
};

export type SicoobPixWebhookPayload = {
  pix?: PixItem[];
  [key: string]: unknown;
};

export type SicoobWebhookResult =
  | { ok: true; processados: number; ignorados: number }
  | { ok: false; reason: string };

export async function processarWebhookPixSicoob(payload: SicoobPixWebhookPayload): Promise<SicoobWebhookResult> {
  if (!Array.isArray(payload.pix)) {
    return { ok: false, reason: "payload sem pix[]" };
  }

  const supabase = createAdminClient();
  const { data: recebido } = await supabase
    .from("webhooks_recebidos")
    .insert({
      provedor: "sicoob",
      evento: "pix",
      payload,
      id_externo: payload.pix.map((p) => p.endToEndId ?? p.e2eId).filter(Boolean).join(",").slice(0, 200),
    })
    .select("id")
    .single();

  let processados = 0;
  let ignorados = 0;

  for (const item of payload.pix) {
    const e2e = item.endToEndId ?? item.e2eId;
    if (!e2e) {
      ignorados += 1;
      continue;
    }

    const confirmado = await consultarPixRecebido(e2e);
    if (!confirmado.ok) {
      await supabase.from("webhooks_recebidos").update({ erro: confirmado.reason }).eq("id", recebido?.id);
      return { ok: false, reason: confirmado.reason };
    }

    const txid = confirmado.data.txid ?? item.txid;
    if (!txid) {
      ignorados += 1;
      continue;
    }

    const { data: pixCobranca } = await supabase
      .from("pix_cobranca")
      .select("id")
      .eq("txid", txid)
      .maybeSingle();

    if (!pixCobranca?.id) {
      ignorados += 1;
      continue;
    }

    const valor = Number(confirmado.data.valor ?? item.valor ?? 0);
    const recebidoEm = confirmado.data.horario ?? item.horario ?? new Date().toISOString();

    const { error } = await supabase.rpc("registrar_pix_recebido", {
      p_end_to_end_id: e2e,
      p_txid: txid,
      p_valor: valor,
      p_recebido_em: recebidoEm,
      p_payload: confirmado.data,
    });

    if (error) {
      await supabase.from("webhooks_recebidos").update({ erro: error.message }).eq("id", recebido?.id);
      return { ok: false, reason: error.message };
    }

    processados += 1;
  }

  if (recebido?.id) {
    await supabase.from("webhooks_recebidos").update({ processado_em: new Date().toISOString() }).eq("id", recebido.id);
  }

  return { ok: true, processados, ignorados };
}
