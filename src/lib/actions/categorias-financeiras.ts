"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formText, formBoolean } from "@/lib/utils";
import { categoriaFinanceiraSchema } from "@/lib/validation/lancamentos";

const BASE = "/financeiro/lancamentos/categorias";

export async function createCategoriaFinanceiraAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "create");
  const parsed = categoriaFinanceiraSchema.safeParse({
    nome: formText(formData, "nome"),
    tipo: formText(formData, "tipo"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) redirect(`${BASE}?erro=validacao`);

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categorias_financeiras")
    .insert({ ...parsed.data, escola_id: DEFAULT_SCHOOL_ID });
  if (error) redirect(`${BASE}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(BASE);
  revalidatePath("/financeiro/lancamentos");
}

export async function updateCategoriaFinanceiraAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "update");
  const id = formText(formData, "id");
  if (!id) redirect(`${BASE}?erro=id`);
  const parsed = categoriaFinanceiraSchema.safeParse({
    nome: formText(formData, "nome"),
    tipo: formText(formData, "tipo"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) redirect(`${BASE}?erro=validacao`);

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categorias_financeiras")
    .update(parsed.data)
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`${BASE}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(BASE);
}

export async function deleteCategoriaFinanceiraAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "delete");
  const id = formText(formData, "id");
  if (!id) redirect(`${BASE}?erro=id`);

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categorias_financeiras")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`${BASE}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(BASE);
}
