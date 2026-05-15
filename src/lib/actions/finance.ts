"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { formNumber, formText } from "@/lib/utils";

export async function createChargeAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const descricao = formText(formData, "descricao");
  if (!alunoId || !descricao) return;

  await createAdminClient().from("cobrancas").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    aluno_id: alunoId,
    descricao,
    competencia: formText(formData, "competencia") ?? new Date().toISOString().slice(0, 7),
    numero_parcela: formNumber(formData, "numero_parcela"),
    valor_original: formNumber(formData, "valor_original") ?? 0,
    valor_desconto: formNumber(formData, "valor_desconto") ?? 0,
    valor_acrescimo: formNumber(formData, "valor_acrescimo") ?? 0,
    data_vencimento: formText(formData, "data_vencimento") ?? new Date().toISOString().slice(0, 10),
    status: "aberta"
  });

  revalidatePath("/financeiro");
}

export async function payChargeAction(formData: FormData) {
  const cobrancaId = formText(formData, "cobranca_id");
  const alunoId = formText(formData, "aluno_id");
  const valorPago = formNumber(formData, "valor_pago");
  if (!cobrancaId || !alunoId || !valorPago) return;

  const supabase = createAdminClient();
  await supabase.from("pagamentos").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    cobranca_id: cobrancaId,
    aluno_id: alunoId,
    data_pagamento: formText(formData, "data_pagamento") ?? new Date().toISOString().slice(0, 10),
    valor_pago: valorPago,
    forma_pagamento: formText(formData, "forma_pagamento") ?? "pix",
    observacao: formText(formData, "observacao")
  });
  await supabase.from("cobrancas").update({ status: "paga" }).eq("id", cobrancaId);

  revalidatePath("/financeiro");
}

export async function cancelChargeAction(formData: FormData) {
  const cobrancaId = formText(formData, "cobranca_id");
  if (!cobrancaId) return;

  await createAdminClient()
    .from("cobrancas")
    .update({ status: "cancelada" })
    .eq("id", cobrancaId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/financeiro");
}
