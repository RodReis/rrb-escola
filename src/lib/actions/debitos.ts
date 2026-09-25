"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { assertOk } from "@/lib/actions/assert-ok";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

const CAMINHO = "/financeiro/tesouraria/conciliacao";

/**
 * Confirma a classificação de um ou mais débitos (um movimento avulso, ou um
 * grupo inteiro da fila "A classificar") através da RPC `classificar_debito`.
 *
 * Por que RPC e não `.upsert()` direto: os únicos índices sobre
 * (origem_tipo, origem_id) em `lancamento_financeiro` são PARCIAIS (`where
 * origem_id is not null` / `where origem_tipo='extrato' and origem_id is not
 * null`). O PostgREST gera `on conflict (origem_tipo, origem_id)` sem
 * cláusula `where` e o Postgres recusa — `.upsert()` do supabase-js não
 * consegue expressar `on conflict ... where ...`. A RPC também torna a
 * escrita (lançamento + vínculo + status + regra, quando marcada) atômica —
 * ou tudo entra, ou nada — e, para lotes, cria a regra UMA VEZ (não uma por
 * movimento) e só classifica com a categoria da regra os movimentos que
 * realmente casam nela (valor exato + janela de dias), deixando o resto de
 * fora do lote em vez de lançar errado.
 *
 * D3: a competência padrão é o mês da data de pagamento de cada movimento
 * (calculada dentro da RPC), mas o formulário pode sobrescrever com uma
 * competência única para o lote inteiro (`p_competencia`) — é assim que um
 * pró-labore de março pago em abril continua lançável em março.
 * D4: a empresa pode ser diferente da dona da conta; a tela avisa quando é.
 */
export type ClassificarDebitoResult = {
  classificados: number;
  foraDaRegra: number;
  message: string;
};

export async function classificarDebitoAction(formData: FormData): Promise<ClassificarDebitoResult> {
  await requirePermission("financeiro.conciliacao", "update");
  const supabase = await createServerClient();

  const extratoIds = formData.getAll("extrato_id").map((v) => String(v)).filter(Boolean);
  const categoriaId = String(formData.get("categoria_id") ?? "");
  const companyId = String(formData.get("company_id") ?? "") || null;
  const classeDespesa = String(formData.get("classe_despesa") ?? "") || null;
  const competencia = String(formData.get("competencia") ?? "").trim() || null;
  const salvarRegra = formData.get("salvar_regra") === "on";
  const soDestaConta = formData.get("regra_so_desta_conta") === "on";
  // "0" é o valor inicial do CurrencyInput (campo deixado em branco), não um
  // valor esperado real — vira "sem valor esperado" (D7 opcional).
  const valorEsperado = Number(formData.get("regra_valor_esperado") ?? 0) || null;
  const diaInicioRaw = formData.get("regra_dia_inicio");
  const diaFimRaw = formData.get("regra_dia_fim");
  const diaInicio = diaInicioRaw ? Number(diaInicioRaw) : null;
  const diaFim = diaFimRaw ? Number(diaFimRaw) : null;

  if (extratoIds.length === 0) throw new Error("Nenhum movimento selecionado");
  if (!categoriaId) throw new Error("Categoria é obrigatória");
  if ((diaInicio === null) !== (diaFim === null)) {
    throw new Error("Informe os dois dias da janela, ou nenhum");
  }
  if (diaInicio !== null && diaFim !== null && diaInicio > diaFim) {
    throw new Error("O dia inicial da janela não pode ser depois do dia final");
  }

  const { data, error } = await supabase.rpc("classificar_debito", {
    p_extrato_ids: extratoIds,
    p_categoria_id: categoriaId,
    p_company_id: companyId,
    p_classe_despesa: classeDespesa,
    p_salvar_regra: salvarRegra,
    p_regra_so_desta_conta: soDestaConta,
    p_regra_valor_esperado: valorEsperado,
    p_regra_dia_inicio: diaInicio,
    p_regra_dia_fim: diaFim,
    p_competencia: competencia,
  });

  if (error) throw error;
  const resultado = data as { ok?: boolean; error?: string; classificados?: number; fora_da_regra?: number } | null;
  if (!resultado?.ok) throw new Error(resultado?.error ?? "Não foi possível classificar o(s) movimento(s)");

  revalidatePath(CAMINHO);

  const classificados = resultado.classificados ?? 0;
  const foraDaRegra = resultado.fora_da_regra ?? 0;
  // O toast tem que refletir o que a RPC REALMENTE lançou, não a quantidade
  // que o usuário selecionou — se a regra tem valor/janela, parte do lote
  // pode ter ficado de fora por não bater (fica pendente, não vira despesa).
  const message =
    foraDaRegra > 0
      ? `${classificados} classificado(s), ${foraDaRegra} fora da janela da regra (continuam pendentes).`
      : classificados > 1
        ? `${classificados} movimentos classificados.`
        : "Movimento classificado.";

  return { classificados, foraDaRegra, message };
}

/**
 * Confirma um débito para CNPJ próprio sem par de crédito casado (D2 — ex.:
 * a Caixa da folha, que paga fora do sistema) como transferência interna.
 * Grava com `credito_extrato_id = null` (a conta de destino não tem extrato
 * no sistema — comentário da Task 3 já previa esse caso) e marca o débito
 * como resolvido (I2: antes desta action não havia NENHUMA ação para este
 * balde, ele ficava para sempre fora de qualquer estado final).
 */
export async function confirmarContaPropriaAction(formData: FormData) {
  await requirePermission("financeiro.conciliacao", "update");
  const supabase = await createServerClient();
  const extratoId = String(formData.get("extrato_id") ?? "");
  if (!extratoId) throw new Error("Movimento inválido");

  const { data: linha } = await supabase
    .from("extrato_bancario")
    .select("conta_id")
    .eq("id", extratoId)
    .maybeSingle();
  if (!linha) throw new Error("Movimento não encontrado");

  assertOk(
    await supabase.from("transferencia_interna").insert({
      escola_id: DEFAULT_SCHOOL_ID,
      debito_extrato_id: extratoId,
      credito_extrato_id: null,
      conta_destino_id: linha.conta_id,
      origem: "manual",
    }),
    "Não foi possível confirmar a transferência",
  );
  assertOk(
    await supabase.from("extrato_bancario").update({ status_conciliacao: "manual" }).eq("id", extratoId),
    "Não foi possível atualizar o status do movimento",
  );

  revalidatePath(CAMINHO);
}

/**
 * Resolve um par ambíguo (dois ou mais créditos candidatos empatados em
 * valor/janela, em contas diferentes) escolhendo manualmente qual crédito é
 * o certo (I2). "Ignorar com motivo" via IgnorarDebitoForm é a outra saída
 * válida para este balde — esta action cobre a escolha positiva.
 */
export async function resolverAmbiguoAction(formData: FormData) {
  await requirePermission("financeiro.conciliacao", "update");
  const supabase = await createServerClient();
  const debitoId = String(formData.get("debito_id") ?? "");
  const creditoId = String(formData.get("credito_id") ?? "");
  if (!debitoId || !creditoId) throw new Error("Selecione o crédito correspondente");

  const { data: credito } = await supabase
    .from("extrato_bancario")
    .select("conta_id")
    .eq("id", creditoId)
    .maybeSingle();
  if (!credito) throw new Error("Crédito não encontrado");

  assertOk(
    await supabase.from("transferencia_interna").insert({
      escola_id: DEFAULT_SCHOOL_ID,
      debito_extrato_id: debitoId,
      credito_extrato_id: creditoId,
      conta_destino_id: credito.conta_id,
      origem: "manual",
    }),
    "Não foi possível confirmar o par",
  );
  assertOk(
    await supabase
      .from("extrato_bancario")
      .update({ status_conciliacao: "manual" })
      .in("id", [debitoId, creditoId]),
    "Não foi possível atualizar o status dos movimentos",
  );

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

/**
 * Baixa um título a pagar com um débito do extrato, pela RPC `baixar_previsto`
 * (atômica: título -> paga, vínculo, status do extrato). Não cria lançamento.
 */
export async function baixarPrevistoAction(formData: FormData) {
  await requirePermission("financeiro.conciliacao", "update");
  const supabase = await createServerClient();
  const extratoId = String(formData.get("extrato_id") ?? "");
  const lancamentoId = String(formData.get("lancamento_id") ?? "");
  if (!extratoId || !lancamentoId) throw new Error("Selecione o título a baixar");

  const { data, error } = await supabase.rpc("baixar_previsto", {
    p_extrato_id: extratoId,
    p_lancamento_id: lancamentoId,
  });
  if (error) throw new Error(error.message);
  const r = data as { ok: boolean; error?: string } | null;
  if (!r?.ok) throw new Error(r?.error ?? "Não foi possível baixar o título");

  revalidatePath(CAMINHO);
  revalidatePath("/financeiro/previsto-realizado");
}

/**
 * Desfaz um par de transferência interna detectado automaticamente.
 *
 * Volta os dois movimentos para "pendente" não basta (I1): sem mais nada, o
 * pipeline reclassifica o MESMO par no próximo carregamento, porque
 * detectarTransferenciasInternas só olha valor/data/conta, sem memória de
 * decisão humana. Por isso o débito (a perna que o usuário via na tela e
 * mandou desfazer) é marcado com `pareamento_recusado` — os dois consumidores
 * do pipeline (aplicar-pipeline.ts, data/debitos.ts) filtram esse débito
 * antes de chamar classificarDebitos, mas ele segue disponível como crédito
 * candidato de outro par, se for o caso.
 */
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
  assertOk(
    await supabase.from("extrato_bancario").update({ status_conciliacao: "pendente" }).in("id", ids),
    "Não foi possível reabrir os movimentos do par",
  );
  assertOk(
    await supabase
      .from("extrato_bancario")
      .update({ pareamento_recusado: true })
      .eq("id", par.debito_extrato_id),
    "Não foi possível marcar o movimento como recusado",
  );
  assertOk(
    await supabase.from("transferencia_interna").delete().eq("id", id),
    "Não foi possível remover o par de transferência",
  );

  revalidatePath(CAMINHO);
}
