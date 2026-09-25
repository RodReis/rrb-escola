"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
    endereco: formData.get("endereco") ?? undefined,
    numero: formData.get("numero") ?? undefined,
    complemento: formData.get("complemento") ?? undefined,
    bairro: formData.get("bairro") ?? undefined,
    cidade: formData.get("cidade") ?? undefined,
    uf: formData.get("uf") ?? undefined,
    cep: formData.get("cep") ?? undefined,
    resolucao: formData.get("resolucao") ?? undefined,
    telefones: formData.get("telefones") ?? undefined,
    email: formData.get("email") ?? undefined,
    site: formData.get("site") ?? undefined,
    whatsapp: formData.get("whatsapp") ?? undefined,
    nomeFantasia: formData.get("nomeFantasia") ?? undefined,
    codigoInep: formData.get("codigoInep") ?? undefined,
    mantenedora: formData.get("mantenedora") ?? undefined,
    secretarioNome: formData.get("secretarioNome") ?? undefined,
    secretarioCargo: formData.get("secretarioCargo") ?? undefined,
    diretorNome: formData.get("diretorNome") ?? undefined,
    diretorCargo: formData.get("diretorCargo") ?? undefined,
    coordenacaoNome: formData.get("coordenacaoNome") ?? undefined,
    coordenacaoCargo: formData.get("coordenacaoCargo") ?? undefined,
    financeiroNome: formData.get("financeiroNome") ?? undefined,
    financeiroCargo: formData.get("financeiroCargo") ?? undefined
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
      numero: parsed.data.numero ?? null,
      complemento: parsed.data.complemento ?? null,
      bairro: parsed.data.bairro ?? null,
      cidade: parsed.data.cidade ?? null,
      uf: parsed.data.uf ?? null,
      cep: parsed.data.cep ?? null,
      resolucao: parsed.data.resolucao ?? null,
      telefones: parsed.data.telefones ?? null,
      email: parsed.data.email ?? null,
      site: parsed.data.site ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      nome_fantasia: parsed.data.nomeFantasia ?? null,
      codigo_inep: parsed.data.codigoInep ?? null,
      mantenedora: parsed.data.mantenedora ?? null,
      secretario_nome: parsed.data.secretarioNome ?? null,
      secretario_cargo: parsed.data.secretarioCargo ?? "Secretário(a)",
      diretor_nome: parsed.data.diretorNome ?? null,
      diretor_cargo: parsed.data.diretorCargo ?? "Diretor(a)",
      coordenacao_nome: parsed.data.coordenacaoNome ?? null,
      coordenacao_cargo: parsed.data.coordenacaoCargo ?? "Coordenador(a)",
      financeiro_nome: parsed.data.financeiroNome ?? null,
      financeiro_cargo: parsed.data.financeiroCargo ?? "Financeiro"
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

// SVG fica de fora: jsPDF (`doc.addImage(..., "PNG", ...)` no histórico) não
// sabe rasterizar SVG e derruba a emissão de histórico com "wrong PNG
// signature" para qualquer escola que tenha subido um logo SVG.
const IMG_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export async function uploadCompanyLogoAction(formData: FormData) {
  await requirePermission("rh.empresas", "update");
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) redirect("/rh/empresas?erro=ID inválido");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/rh/empresas/${id}/editar?erro=sem_arquivo`);
  }
  if (file.size > 2 * 1024 * 1024) {
    redirect(`/rh/empresas/${id}/editar?erro=arquivo_grande`);
  }
  if (!IMG_TYPES.has(file.type)) {
    redirect(`/rh/empresas/${id}/editar?erro=tipo_invalido`);
  }

  const supabase = await createServerClient();
  const ext = EXT_BY_TYPE[file.type] ?? "png";
  const path = `companies/${id}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { data: uploaded, error: uploadErr } = await supabase.storage
    .from("escola-logos")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadErr) redirect(`/rh/empresas/${id}/editar?erro=${encodeURIComponent(uploadErr.message)}`);

  const { error: updateErr } = await supabase
    .from("companies")
    .update({ logo_path: uploaded?.path ?? path })
    .eq("id", id);
  if (updateErr) redirect(`/rh/empresas/${id}/editar?erro=${encodeURIComponent(updateErr.message)}`);

  revalidatePath(`/rh/empresas/${id}`);
  revalidatePath(`/rh/empresas/${id}/editar`);
  redirect(`/rh/empresas/${id}/editar?logo_atualizada=1`);
}

export async function removeCompanyLogoAction(formData: FormData) {
  await requirePermission("rh.empresas", "update");
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) redirect("/rh/empresas?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").update({ logo_path: null }).eq("id", id);
  if (error) redirect(`/rh/empresas/${id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(`/rh/empresas/${id}`);
  revalidatePath(`/rh/empresas/${id}/editar`);
  redirect(`/rh/empresas/${id}/editar?logo_removida=1`);
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
