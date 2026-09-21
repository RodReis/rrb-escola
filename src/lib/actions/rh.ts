"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { CompanySchema, CompanyUpdateSchema, EmployeeSchema, EmployeeUpdateSchema } from "@/lib/validation/rh";

function firstError(error: { issues: { message: string }[] }) {
  return encodeURIComponent(error.issues[0]?.message ?? "Dados inválidos");
}

export async function createCompanyAction(formData: FormData) {
  await requirePermission("rh.empresas", "create");

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
  await requirePermission("rh.empresas", "update");

  const parsed = CompanyUpdateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim(),
    ativo: formData.get("ativo"),
    endereco: formData.get("endereco"),
    cidade: formData.get("cidade"),
    uf: formData.get("uf"),
    cep: formData.get("cep"),
    resolucao: formData.get("resolucao"),
    telefones: formData.get("telefones"),
    email: formData.get("email"),
    secretarioNome: formData.get("secretarioNome"),
    secretarioCargo: formData.get("secretarioCargo"),
    diretorNome: formData.get("diretorNome"),
    diretorCargo: formData.get("diretorCargo")
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
      ativo: parsed.data.ativo,
      endereco: parsed.data.endereco ?? null,
      cidade: parsed.data.cidade ?? null,
      uf: parsed.data.uf ?? null,
      cep: parsed.data.cep ?? null,
      resolucao: parsed.data.resolucao ?? null,
      telefones: parsed.data.telefones ?? null,
      email: parsed.data.email ?? null,
      secretario_nome: parsed.data.secretarioNome ?? null,
      secretario_cargo: parsed.data.secretarioCargo ?? "Secretário(a)",
      diretor_nome: parsed.data.diretorNome ?? null,
      diretor_cargo: parsed.data.diretorCargo ?? "Diretor(a)"
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
  await requirePermission("rh.empresas", "update");
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "on";

  if (!id) redirect("/rh/empresas?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").update({ ativo }).eq("id", id);
  if (error) redirect(`/rh/empresas?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/empresas");
  redirect(`/rh/empresas?ok=${ativo ? "ativada" : "desativada"}`);
}

function readEmployeeForm(formData: FormData) {
  return {
    company_id: String(formData.get("company_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    cpf: String(formData.get("cpf") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    telefone: String(formData.get("telefone") ?? "").trim(),
    cargo: String(formData.get("cargo") ?? "").trim(),
    school_category: String(formData.get("school_category") ?? "").trim(),
    status_contrato: String(formData.get("status_contrato") ?? "").trim(),
    birth_date: String(formData.get("birth_date") ?? "").trim(),
    hire_date: String(formData.get("hire_date") ?? "").trim()
  };
}

export async function createEmployeeAction(formData: FormData) {
  await requirePermission("rh.funcionarios", "create");

  const parsed = EmployeeSchema.safeParse(readEmployeeForm(formData));
  if (!parsed.success) {
    redirect(`/rh/funcionarios/novo?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("employees").insert({
    company_id: parsed.data.company_id,
    name: parsed.data.name,
    cpf: parsed.data.cpf,
    email: parsed.data.email ?? null,
    telefone: parsed.data.telefone ?? null,
    cargo: parsed.data.cargo ?? null,
    school_category: parsed.data.school_category ?? null,
    status_contrato: parsed.data.status_contrato ?? null,
    birth_date: parsed.data.birth_date || null,
    hire_date: parsed.data.hire_date || null
  });

  if (error) {
    const msg = error.code === "23505" ? "CPF já cadastrado" : error.message;
    redirect(`/rh/funcionarios/novo?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/rh/funcionarios");
  revalidatePath(`/rh/empresas/${parsed.data.company_id}`);
  redirect("/rh/funcionarios?ok=criado");
}

export async function updateEmployeeAction(formData: FormData) {
  await requirePermission("rh.funcionarios", "update");

  const id = String(formData.get("id") ?? "");
  const parsed = EmployeeUpdateSchema.safeParse({
    id,
    ...readEmployeeForm(formData),
    ativo: formData.get("ativo")
  });
  if (!parsed.success) {
    redirect(`/rh/funcionarios/${id}/editar?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("employees")
    .update({
      company_id: parsed.data.company_id,
      name: parsed.data.name,
      cpf: parsed.data.cpf,
      email: parsed.data.email ?? null,
      telefone: parsed.data.telefone ?? null,
      cargo: parsed.data.cargo ?? null,
      school_category: parsed.data.school_category ?? null,
      status_contrato: parsed.data.status_contrato ?? null,
      birth_date: parsed.data.birth_date || null,
      hire_date: parsed.data.hire_date || null,
      ativo: parsed.data.ativo
    })
    .eq("id", parsed.data.id);

  if (error) {
    const msg = error.code === "23505" ? "CPF já cadastrado" : error.message;
    redirect(`/rh/funcionarios/${parsed.data.id}/editar?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/rh/funcionarios");
  revalidatePath(`/rh/empresas/${parsed.data.company_id}`);
  redirect("/rh/funcionarios?ok=editado");
}

export async function toggleEmployeeAction(formData: FormData) {
  await requirePermission("rh.funcionarios", "update");
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "on";

  if (!id) redirect("/rh/funcionarios?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("employees").update({ ativo }).eq("id", id);
  if (error) redirect(`/rh/funcionarios?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/funcionarios");
  redirect(`/rh/funcionarios?ok=${ativo ? "ativado" : "desativado"}`);
}

export async function deleteEmployeeAction(formData: FormData) {
  await requirePermission("rh.funcionarios", "delete");
  const id = String(formData.get("id") ?? "");

  if (!id) redirect("/rh/funcionarios?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) redirect(`/rh/funcionarios?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/funcionarios");
  redirect("/rh/funcionarios?ok=excluído");
}
