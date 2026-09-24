"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { assertOk } from "@/lib/actions/assert-ok";

const CAMINHO = "/financeiro/tesouraria/conciliacao";

/**
 * Confirma a classificação de um débito: cria o lançamento pago e o vínculo.
 *
 * O lançamento nasce com origem_tipo='extrato' e origem_id = id do extrato, e o
 * índice único sobre esse par garante que reprocessar não duplica despesa.
 *
 * D3: a competência padrão é o mês do pagamento, e o formulário deixa editar.
 * D4: a empresa pode ser diferente da dona da conta; a tela avisa quando é.
 */
export async function classificarDebitoAction(formData: FormData) {
  const session = await requirePermission("financeiro.conciliacao", "update");
  const supabase = await createServerClient();

  const extratoId = String(formData.get("extrato_id") ?? "");
  const categoriaId = String(formData.get("categoria_id") ?? "");
  const companyId = String(formData.get("company_id") ?? "") || null;
  const competencia = String(formData.get("competencia") ?? "");
  const classeDespesa = String(formData.get("classe_despesa") ?? "") || null;
  const salvarRegra = formData.get("salvar_regra") === "on";

  const { data: linha } = await supabase
    .from("extrato_bancario")
    .select("id, escola_id, conta_id, data, valor, descricao, contraparte_doc")
    .eq("id", extratoId)
    .maybeSingle();

  if (!linha) throw new Error("Movimento não encontrado");

  const { data: lancamento, error } = await supabase
    .from("lancamento_financeiro")
    .upsert(
      {
        escola_id: linha.escola_id,
        tipo: "despesa",
        competencia,
        descricao: String(linha.descricao ?? "Débito Sicoob"),
        categoria_id: categoriaId,
        company_id: companyId,
        classe_despesa: classeDespesa,
        contraparte: linha.contraparte_doc,
        valor: Math.abs(Number(linha.valor)),
        data_vencimento: linha.data,
        data_pagamento: linha.data,
        status: "paga",
        origem_tipo: "extrato",
        origem_id: linha.id,
        criado_por: session.profile.id,
      },
      { onConflict: "origem_tipo,origem_id" },
    )
    .select("id")
    .single();

  if (error) throw error;

  assertOk(
    await supabase.from("conciliacao_vinculo").upsert(
      {
        extrato_id: linha.id,
        alvo_tipo: "lancamento",
        alvo_id: lancamento.id,
        valor: Math.abs(Number(linha.valor)),
        origem: "manual",
        criado_por: session.profile.id,
      },
      { onConflict: "extrato_id,alvo_tipo,alvo_id" },
    ),
    "Não foi possível vincular o lançamento",
  );

  assertOk(
    await supabase.from("extrato_bancario").update({ status_conciliacao: "manual" }).eq("id", linha.id),
    "Não foi possível atualizar o status do movimento",
  );

  // D1: a regra só nasce de ação humana explícita. O checkbox vem DESMARCADO.
  if (salvarRegra && linha.contraparte_doc) {
    assertOk(
      await supabase.from("contraparte_regra").insert({
        escola_id: linha.escola_id,
        tipo_match: "documento",
        documento: linha.contraparte_doc,
        categoria_id: categoriaId,
        company_id: companyId,
        classe_despesa: classeDespesa,
        conta_id: formData.get("regra_so_desta_conta") === "on" ? linha.conta_id : null,
        // "0" é o valor inicial do CurrencyInput (campo deixado em branco), não
        // um valor esperado real — trata como "sem valor esperado" (D7 opcional).
        valor_esperado: Number(formData.get("regra_valor_esperado") ?? 0) || null,
        dia_inicio: formData.get("regra_dia_inicio") ? Number(formData.get("regra_dia_inicio")) : null,
        dia_fim: formData.get("regra_dia_fim") ? Number(formData.get("regra_dia_fim")) : null,
        criado_por: session.profile.id,
      }),
      "Não foi possível salvar a regra",
    );
  }

  revalidatePath(CAMINHO);
}

/** Ignorar passa a exigir motivo — silêncio aqui é movimento financeiro sumindo. */
export async function ignorarDebitoAction(formData: FormData) {
  await requirePermission("financeiro.conciliacao", "update");
  const supabase = await createServerClient();

  const extratoId = String(formData.get("extrato_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) throw new Error("Informe o motivo para ignorar o movimento");

  assertOk(
    await supabase
      .from("extrato_bancario")
      .update({ status_conciliacao: "ignorado", motivo_ignorado: motivo })
      .eq("id", extratoId),
    "Não foi possível ignorar o movimento",
  );

  revalidatePath(CAMINHO);
}

/** Desfaz um par de transferência interna detectado automaticamente. */
export async function desfazerTransferenciaAction(formData: FormData) {
  await requirePermission("financeiro.conciliacao", "update");
  const supabase = await createServerClient();
  const id = String(formData.get("id") ?? "");

  const { data: par } = await supabase
    .from("transferencia_interna")
    .select("debito_extrato_id, credito_extrato_id")
    .eq("id", id)
    .maybeSingle();

  if (!par) return;

  const ids = [par.debito_extrato_id, par.credito_extrato_id].filter(Boolean) as string[];
  await supabase.from("extrato_bancario").update({ status_conciliacao: "pendente" }).in("id", ids);
  await supabase.from("transferencia_interna").delete().eq("id", id);

  revalidatePath(CAMINHO);
}
