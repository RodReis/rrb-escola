"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { gerarRun, recalcularItemDb, recalcularTotaisRun } from "@/lib/folha/service";
import { formNumber, formText } from "@/lib/utils";

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
