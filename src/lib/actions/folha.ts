"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { gerarRun, recalcularItemDb, recalcularTotaisRun } from "@/lib/folha/service";
import { formNumber, formText } from "@/lib/utils";
import { podeTransicionar } from "@/lib/folha/estados";
import { validarRun, gerarDespesasDaRun, gravarProvisoes, type RunParaDespesas } from "@/lib/folha/fechamento";
import { abrirProximoPeriodo } from "@/lib/folha/aquisitivos";

export async function gerarFolhaManualAction(formData: FormData) {
  const session = await requirePermission("rh.folha-v2", "create");
  const companyId = formText(formData, "company_id");
  const competencia = formText(formData, "competencia");
  if (!companyId || !competencia) throw new Error("Empresa e competência obrigatórias");
  try {
    await gerarRun(companyId, competencia, session.profile.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao gerar folha";
    redirect(`/rh/folha-v2?erro=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/rh/folha-v2");
  redirect("/rh/folha-v2?ok=gerada");
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
      editado_por: session.profile.user_id,
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
    .select("*, tipo")
    .eq("id", runId)
    .single();
  if (runErr) throw runErr;
  if (!run) throw new Error("Run não encontrada");

  // folha_config nao tem FK direta de folha_runs (ambas referenciam company);
  // busca por company_id para evitar embedding ambiguo (resolvia em companies).
  const { data: cfg, error: cfgErr } = await supabase
    .from("folha_config")
    .select("categoria_despesa_folha, categoria_despesa_encargos, regra_pagamento, feriados_locais, dia_vencimento_gps, dia_vencimento_fgts")
    .eq("company_id", (run as { company_id: string }).company_id)
    .maybeSingle();
  if (cfgErr) throw cfgErr;

  type RunRow = {
    id: string;
    escola_id: string;
    competencia: string;
    total_liquido: number;
    status: string;
    tipo: string;
    folha_config: RunParaDespesas["folha_config"];
  };
  const runRow = { ...(run as object), folha_config: cfg } as unknown as RunRow;

  if (!podeTransicionar(runRow.status, destino))
    throw new Error(`Transição ${runRow.status} → ${destino} inválida`);

  if (destino === "aprovado") {
    // Validar pendências antes de aprovar
    const pendencias = await validarRun(runId);
    if (pendencias.length) throw new Error(`Pendências bloqueiam aprovação: ${pendencias.join("; ")}`);

    // Gerar despesas de pagamento (líquidos, GPS, FGTS)
    await gerarDespesasDaRun({
      id: runRow.id,
      escola_id: runRow.escola_id,
      competencia: runRow.competencia,
      total_liquido: runRow.total_liquido,
      folha_config: runRow.folha_config,
    });

    // Gravar provisões mensais OU baixar provisões de runs especiais
    if (runRow.tipo === "mensal") {
      await gravarProvisoes(runId, runRow.competencia);
    } else {
      // Runs especiais (decimo_2a, ferias): baixar provisões acumuladas
      const { data: itensRun, error: itensErr } = await supabase
        .from("folha_itens")
        .select("contrato_id, periodo_aquisitivo_id")
        .eq("run_id", runId)
        .eq("status", "ativo");
      if (itensErr) throw itensErr;

      type ItemFecha = { contrato_id: string; periodo_aquisitivo_id: string | null };
      const itensRows = (itensRun ?? []) as unknown as ItemFecha[];
      const contratoIds = itensRows.map((i) => i.contrato_id);

      if (contratoIds.length > 0) {
        const tipoProvisao = runRow.tipo === "decimo_2a" ? "decimo_terceiro" : "ferias";
        const { error: baixaErr } = await supabase
          .from("folha_provisoes")
          .update({ baixada_em: new Date().toISOString() })
          .in("contrato_id", contratoIds)
          .eq("tipo", tipoProvisao)
          .is("baixada_em", null);
        if (baixaErr) throw baixaErr;
      }

      // Férias: marcar período aquisitivo como gozado e abrir próximo
      if (runRow.tipo === "ferias") {
        for (const item of itensRows) {
          if (!item.periodo_aquisitivo_id) continue;
          const { error: gozoErr } = await supabase
            .from("folha_periodos_aquisitivos")
            .update({ status: "gozado", run_id: runId })
            .eq("id", item.periodo_aquisitivo_id);
          if (gozoErr) throw gozoErr;
          await abrirProximoPeriodo(item.periodo_aquisitivo_id);
        }
      }
    }

    const { error: updErr } = await supabase
      .from("folha_runs")
      .update({ status: "aprovado", aprovada_por: session.profile.user_id, aprovada_em: new Date().toISOString() })
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
  revalidatePath(`/rh/folha-v2/${runId}`);
  redirect(`/rh/folha-v2/${runId}?ok=${encodeURIComponent(destino)}`);
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
    .update({ status: "iniciada", reaberta_motivo: motivo })
    .eq("id", runId);
  if (updErr) throw updErr;

  revalidatePath("/rh/folha-v2");
}

export async function excluirRunAction(formData: FormData) {
  await requirePermission("rh.folha-v2", "delete");
  const supabase = await createServerClient();
  const runId = formText(formData, "run_id");
  if (!runId) throw new Error("run_id obrigatório");

  const { data: run, error: runErr } = await supabase
    .from("folha_runs")
    .select("status")
    .eq("id", runId)
    .single();
  if (runErr) throw runErr;
  if (!run) throw new Error("Folha não encontrada");

  type RunStatus = { status: string };
  if ((run as unknown as RunStatus).status !== "iniciada")
    throw new Error("Só folhas em status iniciada podem ser excluídas");

  // folha_itens e folha_lancamentos têm ON DELETE CASCADE a partir de folha_runs
  // despesas têm ON DELETE SET NULL — apagar explicitamente as vinculadas (nenhuma se nunca aprovada)
  const { error: despErr } = await supabase
    .from("despesas")
    .delete()
    .eq("folha_run_id", runId);
  if (despErr) throw despErr;

  const { error: delErr } = await supabase
    .from("folha_runs")
    .delete()
    .eq("id", runId);
  if (delErr) throw delErr;

  revalidatePath("/rh/folha-v2");
}
