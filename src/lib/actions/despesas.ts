"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formNumber, formText } from "@/lib/utils";
import { despesaSchema, FORMAS_PAGAMENTO } from "@/lib/validation/despesas";

function competenciaFromDate(d: string) {
  return d.slice(0, 7);
}

export async function createDespesaAction(formData: FormData) {
  const session = await requireSession();
  const parsed = despesaSchema.safeParse({
    descricao: formText(formData, "descricao"),
    categoria_id: formText(formData, "categoria_id"),
    fornecedor: formText(formData, "fornecedor"),
    valor: formNumber(formData, "valor"),
    data_vencimento: formText(formData, "data_vencimento"),
    data_pagamento: formText(formData, "data_pagamento"),
    forma_pagamento: formText(formData, "forma_pagamento")
  });
  if (!parsed.success) {
    redirect(`/despesas/nova?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const status = parsed.data.data_pagamento ? "paga" : "aberta";
  const { data, error } = await supabase
    .from("despesas")
    .insert({
      ...parsed.data,
      competencia: competenciaFromDate(parsed.data.data_vencimento),
      status,
      escola_id: DEFAULT_SCHOOL_ID,
      criado_por: session.profile.id
    })
    .select("id, competencia")
    .single();
  if (error) redirect(`/despesas/nova?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
  redirect(`/despesas?mes=${data.competencia}`);
}

export async function updateDespesaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  if (!id) redirect("/despesas?erro=id");

  const parsed = despesaSchema.safeParse({
    descricao: formText(formData, "descricao"),
    categoria_id: formText(formData, "categoria_id"),
    fornecedor: formText(formData, "fornecedor"),
    valor: formNumber(formData, "valor"),
    data_vencimento: formText(formData, "data_vencimento"),
    data_pagamento: formText(formData, "data_pagamento"),
    forma_pagamento: formText(formData, "forma_pagamento")
  });
  if (!parsed.success) {
    redirect(`/despesas/${id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("despesas")
    .update({
      ...parsed.data,
      competencia: competenciaFromDate(parsed.data.data_vencimento)
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`/despesas/${id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
  redirect(`/despesas?mes=${competenciaFromDate(parsed.data.data_vencimento)}`);
}

export async function payDespesaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  const data_pagamento = formText(formData, "data_pagamento") ?? new Date().toISOString().slice(0, 10);
  const forma_pagamento = formText(formData, "forma_pagamento");
  if (!id) redirect("/despesas?erro=id");
  if (forma_pagamento && !FORMAS_PAGAMENTO.includes(forma_pagamento as any)) {
    redirect("/despesas?erro=forma_invalida");
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("despesas")
    .update({ status: "paga", data_pagamento, forma_pagamento })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`/despesas?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
}

export async function cancelDespesaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  if (!id) redirect("/despesas?erro=id");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("despesas")
    .update({ status: "cancelada" })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`/despesas?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
}

function adjacentMes(competencia: string, delta: number) {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftVencimento(dataOrigem: string, fromMes: string, toMes: string): string {
  const day = dataOrigem.slice(8, 10);
  const [y, m] = toMes.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const useDay = Math.min(Number(day), lastDay);
  return `${toMes}-${String(useDay).padStart(2, "0")}`;
}

export async function duplicateMonthAction(formData: FormData) {
  const session = await requireSession();
  const toCompetencia = formText(formData, "to") ?? new Date().toISOString().slice(0, 7);
  const fromCompetencia = adjacentMes(toCompetencia, -1);

  const supabase = await createServerClient();

  const { data: existentes, error: errCheck } = await supabase
    .from("despesas")
    .select("id")
    .eq("competencia", toCompetencia)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .limit(1);
  if (errCheck) redirect(`/despesas?mes=${toCompetencia}&erro=${encodeURIComponent(errCheck.message)}`);
  if ((existentes?.length ?? 0) > 0) {
    redirect(`/despesas?mes=${toCompetencia}&erro=mes_destino_nao_vazio`);
  }

  const { data: origem, error: errOrigem } = await supabase
    .from("despesas")
    .select("descricao, categoria_id, fornecedor, valor, data_vencimento")
    .eq("competencia", fromCompetencia)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .neq("status", "cancelada");
  if (errOrigem) redirect(`/despesas?mes=${toCompetencia}&erro=${encodeURIComponent(errOrigem.message)}`);
  if (!origem || origem.length === 0) {
    redirect(`/despesas?mes=${toCompetencia}&erro=mes_origem_vazio`);
  }

  const novas = origem.map((row) => ({
    descricao: row.descricao,
    categoria_id: row.categoria_id,
    fornecedor: row.fornecedor,
    valor: row.valor,
    data_vencimento: shiftVencimento(row.data_vencimento, fromCompetencia, toCompetencia),
    competencia: toCompetencia,
    status: "aberta" as const,
    escola_id: DEFAULT_SCHOOL_ID,
    criado_por: session.profile.id
  }));

  const { error: errInsert } = await supabase.from("despesas").insert(novas);
  if (errInsert) redirect(`/despesas?mes=${toCompetencia}&erro=${encodeURIComponent(errInsert.message)}`);

  revalidatePath("/despesas");
  redirect(`/despesas?mes=${toCompetencia}`);
}
