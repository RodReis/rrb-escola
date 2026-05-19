"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formText, formBoolean } from "@/lib/utils";
import { categoriaSchema } from "@/lib/validation/despesas";

export async function createCategoriaAction(formData: FormData) {
  await requirePermission("despesas", "create");
  const parsed = categoriaSchema.safeParse({
    nome: formText(formData, "nome"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) redirect("/despesas/categorias?erro=validacao");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categorias_despesa")
    .insert({ ...parsed.data, escola_id: DEFAULT_SCHOOL_ID });
  if (error) redirect(`/despesas/categorias?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/despesas/categorias");
  revalidatePath("/despesas");
}

export async function updateCategoriaAction(formData: FormData) {
  await requirePermission("despesas", "update");
  const id = formText(formData, "id");
  if (!id) redirect("/despesas/categorias?erro=id");
  const parsed = categoriaSchema.safeParse({
    nome: formText(formData, "nome"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) redirect("/despesas/categorias?erro=validacao");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categorias_despesa")
    .update(parsed.data)
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`/despesas/categorias?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/despesas/categorias");
}

export async function deleteCategoriaAction(formData: FormData) {
  await requirePermission("despesas", "delete");
  const id = formText(formData, "id");
  if (!id) redirect("/despesas/categorias?erro=id");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categorias_despesa")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`/despesas/categorias?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/despesas/categorias");
}
