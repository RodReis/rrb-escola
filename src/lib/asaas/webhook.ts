import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const EVENTOS_PAGAMENTO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

// Decide se um evento de webhook do Asaas representa pagamento confirmado.
export function eventoConfirmaPagamento(evento: string): boolean {
  return EVENTOS_PAGAMENTO.has(evento);
}

export type WebhookResult =
  | { ok: true; acao: "pago" | "status_atualizado" | "ignorado" }
  | { ok: false; reason: string };

type AsaasWebhookPayload = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    billingType?: string;
  };
};

// Mapeia o billingType do Asaas para a forma_pagamento local.
function formaPagamento(billingType: string | undefined): "pix" | "boleto" {
  return billingType === "BOLETO" ? "boleto" : "pix";
}

export async function processarWebhookAsaas(
  payload: AsaasWebhookPayload,
): Promise<WebhookResult> {
  const event = payload.event ?? "";
  const paymentId = payload.payment?.id;
  if (!paymentId) {
    return { ok: false, reason: "payload sem payment.id" };
  }

  const supabase = createAdminClient();

  // Acha a cobrança pelo id do payment Asaas.
  const { data: cobranca } = await supabase
    .from("cobrancas")
    .select("id, escola_id, aluno_id, matricula_id, valor_final, status")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();

  if (!cobranca) {
    // Payment que não corresponde a nenhuma cobrança local — ignora sem erro.
    return { ok: true, acao: "ignorado" };
  }

  // Atualiza sempre o status reportado pelo Asaas.
  await supabase
    .from("cobrancas")
    .update({ asaas_status: payload.payment?.status ?? event })
    .eq("id", cobranca.id);

  // Só dá baixa se o evento confirma pagamento e a cobrança ainda não está paga.
  if (!eventoConfirmaPagamento(event)) {
    return { ok: true, acao: "status_atualizado" };
  }
  if (cobranca.status === "paga") {
    return { ok: true, acao: "ignorado" };
  }

  const { error: pagErr } = await supabase.from("pagamentos").insert({
    escola_id: cobranca.escola_id,
    cobranca_id: cobranca.id,
    aluno_id: cobranca.aluno_id,
    matricula_id: cobranca.matricula_id,
    data_pagamento: new Date().toISOString().slice(0, 10),
    valor_pago: payload.payment?.value ?? cobranca.valor_final,
    forma_pagamento: formaPagamento(payload.payment?.billingType),
    observacao: "Pagamento confirmado via Asaas",
  });

  if (pagErr) {
    return { ok: false, reason: pagErr.message };
  }

  const { error: statusErr } = await supabase
    .from("cobrancas")
    .update({ status: "paga" })
    .eq("id", cobranca.id);

  if (statusErr) {
    return { ok: false, reason: statusErr.message };
  }

  return { ok: true, acao: "pago" };
}
