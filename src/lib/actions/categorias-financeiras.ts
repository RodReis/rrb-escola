"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formText, formBoolean } from "@/lib/utils";
import { categoriaFinanceiraSchema } from "@/lib/validation/lancamentos";
import type { ActionResult } from "@/lib/actions/types";

const BASE = "/financeiro/lancamentos/categorias";

export async function createCategoriaFinanceiraAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("financeiro.lancamentos", "create");
  const parsed = categoriaFinanceiraSchema.safeParse({
    nome: formText(formData, "nome"),
    tipo: formText(formData, "tipo"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categorias_financeiras")
    .insert({ ...parsed.data, escola_id: DEFAULT_SCHOOL_ID });
  if (error) return { ok: false, error: error.message };
  revalidatePath(BASE);
  revalidatePath("/financeiro/lancamentos");
  return { ok: true, data: undefined };
}

export async function updateCategoriaFinanceiraAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("financeiro.lancamentos", "update");
  const id = formText(formData, "id");
  if (!id) return { ok: false, error: "Categoria não informada." };
  const parsed = categoriaFinanceiraSchema.safeParse({
    nome: formText(formData, "nome"),
    tipo: formText(formData, "tipo"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categorias_financeiras")
    .update(parsed.data)
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) return { ok: false, error: error.message };
  revalidatePath(BASE);
  return { ok: true, data: undefined };
}

export async function deleteCategoriaFinanceiraAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("financeiro.lancamentos", "delete");
  const id = formText(formData, "id");
  if (!id) return { ok: false, error: "Categoria não informada." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categorias_financeiras")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) return { ok: false, error: error.message };
  revalidatePath(BASE);
  return { ok: true, data: undefined };
}
