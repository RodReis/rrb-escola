"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formNumber, formText } from "@/lib/utils";
import { comprovanteSchema, lancamentoSchema, FORMAS_PAGAMENTO } from "@/lib/validation/lancamentos";

const BASE = "/financeiro/lancamentos";

function competenciaFromDate(d: string) {
  return d.slice(0, 7);
}

function parseForm(formData: FormData) {
  const tipo = formText(formData, "tipo") === "receita" ? "receita" : "despesa";
  return lancamentoSchema.safeParse({
    tipo,
    classe_despesa: tipo === "despesa" ? formText(formData, "classe_despesa") : null,
    descricao: formText(formData, "descricao"),
    categoria_id: formText(formData, "categoria_id"),
    contraparte: formText(formData, "contraparte"),
    valor: formNumber(formData, "valor"),
    data_vencimento: formText(formData, "data_vencimento"),
    data_pagamento: formText(formData, "data_pagamento"),
    forma_pagamento: formText(formData, "forma_pagamento")
  });
}

export async function createLancamentoAction(formData: FormData) {
  const session = await requirePermission("financeiro.lancamentos", "create");
  const parsed = parseForm(formData);
  if (!parsed.success) {
    redirect(`${BASE}/novo?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const status = parsed.data.data_pagamento ? "paga" : "aberta";
  const { data, error } = await supabase
    .from("lancamento_financeiro")
    .insert({
      ...parsed.data,
      competencia: competenciaFromDate(parsed.data.data_vencimento),
      status,
      origem_tipo: "manual",
      escola_id: DEFAULT_SCHOOL_ID,
      criado_por: session.profile.id
    })
    .select("id, competencia")
    .single();
  if (error) redirect(`${BASE}/novo?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(BASE);
  redirect(`${BASE}?mes=${data.competencia}`);
}

export async function updateLancamentoAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "update");
  const id = formText(formData, "id");
  if (!id) redirect(`${BASE}?erro=id`);

  const parsed = parseForm(formData);
  if (!parsed.success) {
    redirect(`${BASE}/${id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("lancamento_financeiro")
    .update({
      ...parsed.data,
      competencia: competenciaFromDate(parsed.data.data_vencimento)
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`${BASE}/${id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(BASE);
  redirect(`${BASE}?mes=${competenciaFromDate(parsed.data.data_vencimento)}`);
}

export async function payLancamentoAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "update");
  const id = formText(formData, "id");
  const data_pagamento = formText(formData, "data_pagamento") ?? new Date().toISOString().slice(0, 10);
  const forma_pagamento = formText(formData, "forma_pagamento");
  if (!id) redirect(`${BASE}?erro=id`);
  if (forma_pagamento && !FORMAS_PAGAMENTO.includes(forma_pagamento as any)) {
    redirect(`${BASE}?erro=forma_invalida`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("lancamento_financeiro")
    .update({ status: "paga", data_pagamento, forma_pagamento })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`${BASE}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(BASE);
}

export async function cancelLancamentoAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "update");
  const id = formText(formData, "id");
  if (!id) redirect(`${BASE}?erro=id`);

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("lancamento_financeiro")
    .update({ status: "cancelada" })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`${BASE}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(BASE);
}

export async function uploadComprovanteLancamentoAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "update");
  const id = formText(formData, "id");
  const file = formData.get("file");
  if (!id) redirect(`${BASE}?erro=id`);
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${BASE}/${id}/editar?erro=arquivo_vazio`);
  }

  const parsed = comprovanteSchema.safeParse({ size: file.size, type: file.type });
  if (!parsed.success) {
    redirect(`${BASE}/${id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "comprovante_invalido")}`);
  }

  const supabase = await createServerClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${id}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: errUpload } = await supabase.storage
    .from("despesas-comprovantes")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (errUpload) redirect(`${BASE}/${id}/editar?erro=${encodeURIComponent(errUpload.message)}`);

  const { error: errUpdate } = await supabase
    .from("lancamento_financeiro")
    .update({ comprovante_path: path })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (errUpdate) redirect(`${BASE}/${id}/editar?erro=${encodeURIComponent(errUpdate.message)}`);

  revalidatePath(BASE);
  redirect(`${BASE}/${id}/editar`);
}

export async function removeComprovanteLancamentoAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "update");
  const id = formText(formData, "id");
  const path = formText(formData, "path");
  if (!id || !path) redirect(`${BASE}?erro=id`);

  const supabase = await createServerClient();
  await supabase.storage.from("despesas-comprovantes").remove([path]);
  await supabase
    .from("lancamento_financeiro")
    .update({ comprovante_path: null })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath(BASE);
  redirect(`${BASE}/${id}/editar`);
}

export async function getComprovanteUrlLancamentoAction(path: string): Promise<string | null> {
  await requirePermission("financeiro.lancamentos", "read");
  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from("despesas-comprovantes")
    .createSignedUrl(path, 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
