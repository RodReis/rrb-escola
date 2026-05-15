"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { generateChargesForEnrollment } from "@/lib/server/generate-charges";
import { createServerClient } from "@/lib/supabase/server";
import { formNumber, formText } from "@/lib/utils";

export async function createChargeAction(formData: FormData) {
  await requireSession();
  const alunoId = formText(formData, "aluno_id");
  const descricao = formText(formData, "descricao");
  if (!alunoId || !descricao) return;

  const supabase = await createServerClient();
  await supabase.from("cobrancas").insert({
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

export async function updateChargeAction(formData: FormData) {
  await requireSession();
  const cobrancaId = formText(formData, "cobranca_id");
  if (!cobrancaId) redirect("/financeiro?erro=id");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("cobrancas")
    .update({
      descricao: formText(formData, "descricao") ?? undefined,
      data_vencimento: formText(formData, "data_vencimento") ?? undefined,
      valor_desconto: formNumber(formData, "valor_desconto") ?? 0,
      valor_acrescimo: formNumber(formData, "valor_acrescimo") ?? 0
    })
    .eq("id", cobrancaId)
    .neq("status", "paga");

  if (error) redirect(`/financeiro?erro=editar`);
  await supabase.rpc("recalc_cobranca_status", { p_cobranca_id: cobrancaId });
  revalidatePath("/financeiro");
}

export async function payChargeAction(formData: FormData) {
  const session = await requireSession();
  const cobrancaId = formText(formData, "cobranca_id");
  const alunoId = formText(formData, "aluno_id");
  const valorPago = formNumber(formData, "valor_pago");
  if (!cobrancaId || !alunoId || !valorPago) redirect("/financeiro?erro=campos");

  const supabase = await createServerClient();
  const { data: cobranca } = await supabase
    .from("cobrancas")
    .select("status")
    .eq("id", cobrancaId)
    .single();
  if (!cobranca || cobranca.status === "cancelada") redirect("/financeiro?erro=paga");
  const { error } = await supabase.from("pagamentos").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    cobranca_id: cobrancaId,
    aluno_id: alunoId,
    data_pagamento: formText(formData, "data_pagamento") ?? new Date().toISOString().slice(0, 10),
    valor_pago: valorPago,
    forma_pagamento: formText(formData, "forma_pagamento") ?? "pix",
    observacao: formText(formData, "observacao"),
    registrado_por: session.profile.id
  });

  if (error) redirect("/financeiro?erro=pagamento");
  // Trigger pagamentos_recalc_status atualiza cobrancas.status automaticamente.
  revalidatePath("/financeiro");
}

export async function cancelPaymentAction(formData: FormData) {
  const session = await requireSession();
  const pagamentoId = formText(formData, "pagamento_id");
  const motivo = formText(formData, "motivo") ?? "Sem motivo informado";
  if (!pagamentoId) redirect("/financeiro?erro=id");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pagamentos")
    .update({
      cancelado_em: new Date().toISOString(),
      cancelado_por: session.profile.id,
      motivo_cancelamento: motivo
    })
    .eq("id", pagamentoId)
    .is("cancelado_em", null);

  if (error) redirect("/financeiro?erro=estornar");
  // Trigger recalcula status da cobranca.
  revalidatePath("/financeiro");
}

export async function cancelChargeAction(formData: FormData) {
  await requireSession();
  const cobrancaId = formText(formData, "cobranca_id");
  if (!cobrancaId) return;

  const supabase = await createServerClient();
  await supabase
    .from("cobrancas")
    .update({ status: "cancelada" })
    .eq("id", cobrancaId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/financeiro");
}

export async function generateChargesForEnrollmentAction(formData: FormData) {
  await requireSession();
  const matriculaId = formText(formData, "matricula_id");
  if (!matriculaId) redirect("/matriculas?erro=id");

  const supabase = await createServerClient();
  const { data: matricula } = await supabase
    .from("matriculas")
    .select("id, escola_id, aluno_id, plano_id, data_matricula, ano_letivo")
    .eq("id", matriculaId)
    .single();

  if (!matricula?.plano_id) redirect(`/matriculas/${matriculaId}?erro=plano`);

  await generateChargesForEnrollment({
    supabase,
    escolaId: matricula.escola_id,
    alunoId: matricula.aluno_id,
    matriculaId: matricula.id,
    planoId: matricula.plano_id,
    dataMatricula: matricula.data_matricula,
    anoLetivo: matricula.ano_letivo
  });

  revalidatePath(`/matriculas/${matriculaId}`);
  redirect(`/matriculas/${matriculaId}?gerado=1`);
}
