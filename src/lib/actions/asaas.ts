"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { criarCustomer, criarCobranca } from "@/lib/asaas/client";

export type GerarCobrancaResult =
  | { ok: true; invoiceUrl: string }
  | { ok: false; error: string };

export async function gerarCobrancaAsaasAction(
  cobrancaId: string,
): Promise<GerarCobrancaResult> {
  const session = await requirePermission("financeiro.cobrancas", "update");
  const supabase = await createServerClient();

  // Carrega a cobrança.
  const { data: cobranca } = await supabase
    .from("cobrancas")
    .select("id, aluno_id, descricao, valor_final, data_vencimento, status, asaas_payment_id")
    .eq("id", cobrancaId)
    .eq("escola_id", session.profile.escola_id)
    .maybeSingle();

  if (!cobranca) return { ok: false, error: "Cobrança não encontrada" };
  if (cobranca.status === "paga" || cobranca.status === "cancelada") {
    return { ok: false, error: "Cobrança já está paga ou cancelada" };
  }
  if (cobranca.asaas_payment_id) {
    return { ok: false, error: "Cobrança já tem boleto gerado" };
  }

  // Responsável financeiro do aluno.
  const { data: responsavel } = await supabase
    .from("responsaveis_aluno")
    .select("id, nome, cpf, email, celular, asaas_customer_id")
    .eq("aluno_id", cobranca.aluno_id)
    .eq("responsavel_financeiro", true)
    .maybeSingle();

  if (!responsavel) {
    return { ok: false, error: "Aluno sem responsável financeiro cadastrado" };
  }
  if (!responsavel.cpf || !responsavel.nome) {
    return { ok: false, error: "Responsável financeiro precisa de nome e CPF cadastrados" };
  }

  // Customer lazy: cria no Asaas na primeira vez.
  let customerId = responsavel.asaas_customer_id;
  if (!customerId) {
    const cliente = await criarCustomer({
      nome: responsavel.nome,
      cpfCnpj: responsavel.cpf,
      email: responsavel.email,
      celular: responsavel.celular,
    });
    if (!cliente.ok) return { ok: false, error: cliente.reason };
    customerId = cliente.data.id;
    const { error: custErr } = await supabase
      .from("responsaveis_aluno")
      .update({ asaas_customer_id: customerId })
      .eq("id", responsavel.id);
    if (custErr) {
      return { ok: false, error: "Erro ao salvar o customer Asaas. Tente novamente." };
    }
  }

  // Cria a cobrança no Asaas.
  const pagamento = await criarCobranca({
    customerId,
    valor: Number(cobranca.valor_final),
    vencimento: cobranca.data_vencimento,
    descricao: cobranca.descricao,
  });
  if (!pagamento.ok) return { ok: false, error: pagamento.reason };

  // Grava os dados do Asaas na cobrança.
  const { error: updErr } = await supabase
    .from("cobrancas")
    .update({
      asaas_payment_id: pagamento.data.id,
      asaas_invoice_url: pagamento.data.invoiceUrl,
      asaas_status: pagamento.data.status,
    })
    .eq("id", cobranca.id);

  if (updErr) {
    return {
      ok: false,
      error: "Cobrança gerada no Asaas, mas não foi salva. Contate o suporte.",
    };
  }

  revalidatePath(`/alunos/${cobranca.aluno_id}`);
  return { ok: true, invoiceUrl: pagamento.data.invoiceUrl };
}
