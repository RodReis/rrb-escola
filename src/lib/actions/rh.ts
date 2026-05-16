"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { CompanySchema, CompanyUpdateSchema } from "@/lib/validation/rh";

function firstError(error: { issues: { message: string }[] }) {
  return encodeURIComponent(error.issues[0]?.message ?? "Dados inválidos");
}

export async function createCompanyAction(formData: FormData) {
  await requirePerfil(["admin"]);

  const parsed = CompanySchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim()
  });
  if (!parsed.success) {
    redirect(`/rh/empresas/nova?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").insert({
    name: parsed.data.name,
    cnpj: parsed.data.cnpj
  });

  if (error) {
    const msg = error.code === "23505" ? "CNPJ já cadastrado" : error.message;
    redirect(`/rh/empresas/nova?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/rh/empresas");
  redirect("/rh/empresas?ok=criada");
}

export async function updateCompanyAction(formData: FormData) {
  await requirePerfil(["admin"]);

  const parsed = CompanyUpdateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim(),
    ativo: formData.get("ativo")
  });
  if (!parsed.success) {
    const id = formData.get("id");
    redirect(`/rh/empresas/${id}/editar?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("companies")
    .update({
      name: parsed.data.name,
      cnpj: parsed.data.cnpj,
      ativo: parsed.data.ativo
    })
    .eq("id", parsed.data.id);

  if (error) {
    const msg = error.code === "23505" ? "CNPJ já cadastrado" : error.message;
    redirect(`/rh/empresas/${parsed.data.id}/editar?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/rh/empresas");
  revalidatePath(`/rh/empresas/${parsed.data.id}`);
  redirect("/rh/empresas?ok=editada");
}

export async function toggleCompanyAction(formData: FormData) {
  await requirePerfil(["admin"]);
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "on";

  if (!id) redirect("/rh/empresas?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").update({ ativo }).eq("id", id);
  if (error) redirect(`/rh/empresas?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/empresas");
  redirect(`/rh/empresas?ok=${ativo ? "ativada" : "desativada"}`);
}
