"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { gerarRun, recalcularItemDb, recalcularTotaisRun } from "@/lib/folha/service";
import { formNumber, formText } from "@/lib/utils";
import { podeTransicionar } from "@/lib/folha/estados";
import { validarRun, gerarDespesasDaRun, gravarProvisoes, type RunParaDespesas } from "@/lib/folha/fechamento";

export async function gerarFolhaManualAction(formData: FormData) {
  const session = await requirePermission("rh.folha-v2", "create");
  const companyId = formText(formData, "company_id");
  const competencia = formText(formData, "competencia");
  if (!companyId || !competencia) throw new Error("Empresa e competência obrigatórias");
  await gerarRun(companyId, competencia, session.profile.id);
  revalidatePath("/rh/folha-v2");
}

export async function editarLancamentoAction(formData: FormData) {
  const session = await requirePermission("rh.folha-v2", "update");
  const supabase = await createServerClient();
  const id = formText(formData, "lancamento_id");
  const valor = formNumber(formData, "valor");
  if (!id || valor == null) throw new Error("Dados inválidos");

  const { data: lanc } = await supabase
    .from("folha_lancamentos")
    .select("valor, origem, item_id, folha_itens(run_id, contrato_id)")
    .eq("id", id)
    .single();
  if (!lanc) throw new Error("Lançamento não encontrado");

  type LancRow = {
    valor: number;
    origem: string;
    item_id: string;
    folha_itens: { run_id: string; contrato_id: string } | null;
  };
  const row = lanc as unknown as LancRow;
  if (!row.folha_itens) throw new Error("Item do lançamento não encontrado");

  const { error: updError } = await supabase
    .from("folha_lancamentos")
    .update({
      valor,
      origem: "manual",
      valor_calculado: row.origem === "auto" ? row.valor : undefined,
      editado_por: session.profile.id,
    })
    .eq("id", id);
  if (updError) throw updError;

  await recalcularItemDb(row.folha_itens.run_id, row.folha_itens.contrato_id);
  await recalcularTotaisRun(row.folha_itens.run_id);
  revalidatePath("/rh/folha-v2");
}

export async function adicionarLancamentoAction(formData: FormData) {
  await requirePermission("rh.folha-v2", "update");
  const supabase = await createServerClient();
  const itemId = formText(formData, "item_id");
  const rubricaId = formText(formData, "rubrica_id");
  const valor = formNumber(formData, "valor");
  const parcelas = formNumber(formData, "recorrente_parcelas");
  if (!itemId || !rubricaId || valor == null) throw new Error("Dados inválidos");

  const { data: item } = await supabase
    .from("folha_itens")
    .select("run_id, contrato_id")
    .eq("id", itemId)
    .single();
  if (!item) throw new Error("Item não encontrado");

  type ItemRow = { run_id: string; contrato_id: string };
  const itemRow = item as unknown as ItemRow;

  const { error: insError } = await supabase.from("folha_lancamentos").insert({
    item_id: itemId,
    rubrica_id: rubricaId,
    valor,
    origem: "manual",
    recorrente_parcelas: parcelas ?? null,
    recorrente_parcela_atual: parcelas ? 1 : null,
  });
  if (insError) throw insError;

  await recalcularItemDb(itemRow.run_id, itemRow.contrato_id);
  await recalcularTotaisRun(itemRow.run_id);
  revalidatePath("/rh/folha-v2");
}

export async function excluirItemAction(formData: FormData) {
  await requirePermission("rh.folha-v2", "update");
  const supabase = await createServerClient();
  const itemId = formText(formData, "item_id");
  if (!itemId) throw new Error("item_id obrigatório");

  const { data: item } = await supabase
    .from("folha_itens")
    .select("run_id, status")
    .eq("id", itemId)
    .single();
  if (!item) throw new Error("Item não encontrado");

  type ItemStatusRow = { run_id: string; status: string };
  const itemRow = item as unknown as ItemStatusRow;

  const { error: updError } = await supabase
    .from("folha_itens")
    .update({ status: itemRow.status === "ativo" ? "excluido" : "ativo" })
    .eq("id", itemId);
  if (updError) throw updError;

  await recalcularTotaisRun(itemRow.run_id);
  revalidatePath("/rh/folha-v2");
}

export async function transicionarRunAction(formData: FormData) {
  const session = await requirePermission("rh.folha-v2", "update");
  const supabase = await createServerClient();
  const runId = formText(formData, "run_id");
  const destino = formText(formData, "destino");
  if (!runId || !destino) throw new Error("Dados inválidos");

  const { data: run, error: runErr } = await supabase
    .from("folha_runs")
    .select(
      "*, folha_config:company_id(categoria_despesa_folha, categoria_despesa_encargos, regra_pagamento, feriados_locais, dia_vencimento_gps, dia_vencimento_fgts)",
    )
    .eq("id", runId)
    .single();
  if (runErr) throw runErr;
  if (!run) throw new Error("Run não encontrada");

  type RunRow = {
    id: string;
    escola_id: string;
    competencia: string;
    total_liquido: number;
    status: string;
    folha_config: RunParaDespesas["folha_config"];
  };
  const runRow = run as unknown as RunRow;

  if (!podeTransicionar(runRow.status, destino))
    throw new Error(`Transição ${runRow.status} → ${destino} inválida`);

  if (destino === "aprovada") {
    const pendencias = await validarRun(runId);
    if (pendencias.length) throw new Error(`Pendências bloqueiam aprovação: ${pendencias.join("; ")}`);
    await gerarDespesasDaRun({
      id: runRow.id,
      escola_id: runRow.escola_id,
      competencia: runRow.competencia,
      total_liquido: runRow.total_liquido,
      folha_config: runRow.folha_config,
    });
    const { error: updErr } = await supabase
      .from("folha_runs")
      .update({ status: destino, aprovada_por: session.profile.id, aprovada_em: new Date().toISOString() })
      .eq("id", runId);
    if (updErr) throw updErr;
  } else if (destino === "paga") {
    const { error: despErr } = await supabase
      .from("despesas")
      .update({ data_pagamento: new Date().toISOString().slice(0, 10), status: "paga" })
      .eq("folha_run_id", runId)
      .eq("status", "aberta");
    if (despErr) throw despErr;
    const { error: updErr } = await supabase
      .from("folha_runs")
      .update({ status: destino, paga_em: new Date().toISOString() })
      .eq("id", runId);
    if (updErr) throw updErr;
  } else if (destino === "fechada") {
    await gravarProvisoes(runId, runRow.competencia);
    const { error: updErr } = await supabase
      .from("folha_runs")
      .update({ status: destino, fechada_por: session.profile.id, fechada_em: new Date().toISOString() })
      .eq("id", runId);
    if (updErr) throw updErr;
  } else {
    const { error: updErr } = await supabase
      .from("folha_runs")
      .update({ status: destino })
      .eq("id", runId);
    if (updErr) throw updErr;
  }
  revalidatePath("/rh/folha-v2");
}

export async function validarRunAction(runId: string): Promise<string[]> {
  await requirePermission("rh.folha-v2", "read");
  return validarRun(runId);
}

export async function reabrirRunAction(formData: FormData) {
  const session = await requirePermission("rh.folha-v2", "delete");
  if (session.profile.perfil !== "admin") throw new Error("Apenas admin reabre folha");
  const supabase = await createServerClient();
  const runId = formText(formData, "run_id");
  const motivo = formText(formData, "motivo");
  if (!runId || !motivo) throw new Error("Motivo obrigatório");

  const { data: runData, error: runErr } = await supabase
    .from("folha_runs")
    .select("competencia")
    .eq("id", runId)
    .single();
  if (runErr) throw runErr;

  const { data: itensData, error: itensErr } = await supabase
    .from("folha_itens")
    .select("contrato_id")
    .eq("run_id", runId);
  if (itensErr) throw itensErr;

  const { error: despErr } = await supabase
    .from("despesas")
    .delete()
    .eq("folha_run_id", runId)
    .eq("status", "aberta");
  if (despErr) throw despErr;

  const contratoIds = (itensData ?? []).map((i) => (i as unknown as { contrato_id: string }).contrato_id);
  if (contratoIds.length > 0) {
    const { error: provErr } = await supabase
      .from("folha_provisoes")
      .delete()
      .eq("competencia", runData.competencia)
      .in("contrato_id", contratoIds);
    if (provErr) throw provErr;
  }

  const { error: updErr } = await supabase
    .from("folha_runs")
    .update({ status: "rascunho", reaberta_motivo: motivo })
    .eq("id", runId);
  if (updErr) throw updErr;

  revalidatePath("/rh/folha-v2");
}
