"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formBoolean, formNumber, formText } from "@/lib/utils";
import { contratoSchema } from "@/lib/validation/contratos";

const BASE = "/financeiro/contratos";

function parse(formData: FormData) {
  return contratoSchema.safeParse({
    descricao: formText(formData, "descricao"),
    contraparte: formText(formData, "contraparte"),
    valor: formNumber(formData, "valor"),
    dia_vencimento: formNumber(formData, "dia_vencimento"),
    categoria_id: formText(formData, "categoria_id"),
    ativo: formBoolean(formData, "ativo"),
    inicio: formText(formData, "inicio"),
    fim: formText(formData, "fim")
  });
}

export async function createContratoAction(formData: FormData) {
  await requirePermission("financeiro.contratos", "create");
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`${BASE}/novo?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("contrato_receita")
    .insert({ ...parsed.data, escola_id: DEFAULT_SCHOOL_ID });
  if (error) redirect(`${BASE}/novo?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(BASE);
  redirect(BASE);
}

export async function updateContratoAction(formData: FormData) {
  await requirePermission("financeiro.contratos", "update");
  const id = formText(formData, "id");
  if (!id) redirect(`${BASE}?erro=id`);
  const parsed = parse(formData);
  if (!parsed.success) {
    redirect(`${BASE}?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("contrato_receita")
    .update(parsed.data)
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`${BASE}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(BASE);
  redirect(BASE);
}

// Gera os lançamentos de receita da competência via RPC idempotente.
export async function gerarLancamentosAction(formData: FormData) {
  await requirePermission("financeiro.contratos", "update");
  const competencia = formText(formData, "competencia");
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    redirect(`${BASE}?erro=competencia_invalida`);
  }
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("gerar_lancamentos_contratos", { p_competencia: competencia });
  if (error) redirect(`${BASE}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(BASE);
  revalidatePath("/financeiro/lancamentos");
  redirect(`${BASE}?gerados=${data ?? 0}&mes=${competencia}`);
}
