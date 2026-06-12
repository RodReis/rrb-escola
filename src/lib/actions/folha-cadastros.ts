"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formText, formNumber, formBoolean } from "@/lib/utils";
import {
  rubricaSchema,
  contratoSchema,
  configSchema,
  verbaContratualSchema,
} from "@/lib/validation/folha";
import { criarPeriodoInicial } from "@/lib/folha/aquisitivos";

const PERM = "rh.folha-v2" as const;
const REVALIDATE = "/rh/folha-v2";

export async function createRubricaAction(formData: FormData) {
  await requirePermission(PERM, "create");
  const parsed = rubricaSchema.safeParse({
    escola_id: DEFAULT_SCHOOL_ID,
    codigo: formText(formData, "codigo"),
    nome: formText(formData, "nome"),
    tipo: formText(formData, "tipo"),
    metodo_calculo: formText(formData, "metodo_calculo"),
    incide_inss: formData.get("incide_inss"),
    incide_irrf: formData.get("incide_irrf"),
    incide_fgts: formData.get("incide_fgts"),
    incide_dsr: formData.get("incide_dsr"),
    ordem_holerite: formText(formData, "ordem_holerite"),
    ativa: formData.get("ativa"),
  });
  if (!parsed.success) {
    redirect(
      `/rh/folha-v2/rubricas/nova?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`
    );
  }
  const supabase = await createServerClient();
  const { error } = await supabase.from("folha_rubricas").insert(parsed.data);
  if (error) {
    redirect(
      `/rh/folha-v2/rubricas/nova?erro=${encodeURIComponent(error.message)}`
    );
  }
  revalidatePath(`${REVALIDATE}/rubricas`);
  redirect("/rh/folha-v2/rubricas");
}

export async function updateRubricaAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const id = formText(formData, "id");
  if (!id) redirect("/rh/folha-v2/rubricas");
  const parsed = rubricaSchema.safeParse({
    escola_id: DEFAULT_SCHOOL_ID,
    codigo: formText(formData, "codigo"),
    nome: formText(formData, "nome"),
    tipo: formText(formData, "tipo"),
    metodo_calculo: formText(formData, "metodo_calculo"),
    incide_inss: formData.get("incide_inss"),
    incide_irrf: formData.get("incide_irrf"),
    incide_fgts: formData.get("incide_fgts"),
    incide_dsr: formData.get("incide_dsr"),
    ordem_holerite: formText(formData, "ordem_holerite"),
    ativa: formData.get("ativa"),
  });
  if (!parsed.success) {
    redirect(
      `/rh/folha-v2/rubricas/${id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`
    );
  }
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("folha_rubricas")
    .update(parsed.data)
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) {
    redirect(
      `/rh/folha-v2/rubricas/${id}/editar?erro=${encodeURIComponent(error.message)}`
    );
  }
  revalidatePath(`${REVALIDATE}/rubricas`);
  redirect("/rh/folha-v2/rubricas");
}

export async function deleteRubricaAction(formData: FormData) {
  await requirePermission(PERM, "delete");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("folha_rubricas")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) throw error;
  revalidatePath(`${REVALIDATE}/rubricas`);
}

export async function createPerfilAction(formData: FormData) {
  await requirePermission(PERM, "create");
  const codigo = formText(formData, "codigo");
  const nome = formText(formData, "nome");
  if (!codigo || !nome) redirect("/rh/folha-v2/perfis?erro=campos_obrigatorios");
  const supabase = await createServerClient();
  const { error } = await supabase.from("folha_perfis_calculo").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    codigo,
    nome,
    ativo: true,
  });
  if (error) {
    redirect(
      `/rh/folha-v2/perfis?erro=${encodeURIComponent(error.message)}`
    );
  }
  revalidatePath(`${REVALIDATE}/perfis`);
  redirect("/rh/folha-v2/perfis");
}

export async function updatePerfilAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const id = formText(formData, "id");
  const codigo = formText(formData, "codigo");
  const nome = formText(formData, "nome");
  if (!id || !codigo || !nome) redirect("/rh/folha-v2/perfis?erro=campos_obrigatorios");
  const ativo = formBoolean(formData, "ativo");
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("folha_perfis_calculo")
    .update({ codigo, nome, ativo })
    .eq("id", id!)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) throw error;
  revalidatePath(`${REVALIDATE}/perfis`);
  redirect("/rh/folha-v2/perfis");
}

export async function deletePerfilAction(formData: FormData) {
  await requirePermission(PERM, "delete");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("folha_perfis_calculo")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) throw error;
  revalidatePath(`${REVALIDATE}/perfis`);
}

export async function addRubricaAoPerfilAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const perfilId = formText(formData, "perfil_id");
  const rubricaId = formText(formData, "rubrica_id");
  const ordemExecucao = formNumber(formData, "ordem_execucao") ?? 100;
  const automatica = formBoolean(formData, "automatica");
  if (!perfilId || !rubricaId) throw new Error("perfil_id e rubrica_id obrigatórios");
  const supabase = await createServerClient();
  const { error } = await supabase.from("folha_perfis_rubricas").insert({
    perfil_id: perfilId,
    rubrica_id: rubricaId,
    ordem_execucao: ordemExecucao,
    automatica,
  });
  if (error) throw error;
  revalidatePath(`${REVALIDATE}/perfis`);
}

export async function updateRubricaDoPerfilAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const id = formText(formData, "id");
  const ordemExecucao = formNumber(formData, "ordem_execucao") ?? 100;
  const automatica = formBoolean(formData, "automatica");
  if (!id) throw new Error("id obrigatório");
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("folha_perfis_rubricas")
    .update({ ordem_execucao: ordemExecucao, automatica })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`${REVALIDATE}/perfis`);
}

export async function removeRubricaDoPerfilAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("folha_perfis_rubricas")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`${REVALIDATE}/perfis`);
}

export async function createContratoAction(formData: FormData) {
  await requirePermission(PERM, "create");
  const parsed = contratoSchema.safeParse({
    company_id: formText(formData, "company_id"),
    funcionario_id: formText(formData, "funcionario_id"),
    perfil_calculo_id: formText(formData, "perfil_calculo_id"),
    salario_base: formText(formData, "salario_base"),
    valor_hora_aula: formText(formData, "valor_hora_aula"),
    aulas_semanais: formText(formData, "aulas_semanais"),
    dependentes_irrf: formText(formData, "dependentes_irrf"),
    ativo: formData.get("ativo"),
    cargo: formText(formData, "cargo"),
    cbo: formText(formData, "cbo"),
    aulas_manha: formText(formData, "aulas_manha"),
    aulas_tarde: formText(formData, "aulas_tarde"),
    aulas_noite: formText(formData, "aulas_noite"),
  });
  if (!parsed.success) {
    redirect(
      `/rh/folha-v2/contratos/novo?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`
    );
  }
  const data_admissao = formText(formData, "data_admissao");
  if (!data_admissao) {
    redirect("/rh/folha-v2/contratos/novo?erro=data_admissao_obrigatoria");
  }
  const { aulas_manha, aulas_tarde, aulas_noite } = parsed.data;
  const aulas_por_turno =
    aulas_manha != null || aulas_tarde != null || aulas_noite != null
      ? { manha: aulas_manha ?? null, tarde: aulas_tarde ?? null, noite: aulas_noite ?? null }
      : null;
  const supabase = await createServerClient();
  const { data: contrato, error } = await supabase
    .from("folha_contratos")
    .insert({
      escola_id: DEFAULT_SCHOOL_ID,
      employee_id: parsed.data.funcionario_id,
      company_id: parsed.data.company_id,
      perfil_calculo_id: parsed.data.perfil_calculo_id,
      salario_base: parsed.data.salario_base ?? null,
      valor_hora_aula: parsed.data.valor_hora_aula ?? null,
      aulas_semanais: parsed.data.aulas_semanais ?? null,
      dependentes_irrf: parsed.data.dependentes_irrf,
      data_admissao: data_admissao!,
      ativo: parsed.data.ativo,
      cargo: parsed.data.cargo ?? null,
      cbo: parsed.data.cbo ?? null,
      aulas_por_turno,
    })
    .select("id")
    .single();
  if (error) {
    redirect(
      `/rh/folha-v2/contratos/novo?erro=${encodeURIComponent(error.message)}`
    );
  }
  await criarPeriodoInicial(contrato.id);
  revalidatePath(`${REVALIDATE}/contratos`);
  redirect(`/rh/folha-v2/contratos/${contrato.id}/editar`);
}

export async function updateContratoAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const id = formText(formData, "id");
  if (!id) redirect("/rh/folha-v2/contratos");
  const parsed = contratoSchema.safeParse({
    company_id: formText(formData, "company_id"),
    funcionario_id: formText(formData, "funcionario_id"),
    perfil_calculo_id: formText(formData, "perfil_calculo_id"),
    salario_base: formText(formData, "salario_base"),
    valor_hora_aula: formText(formData, "valor_hora_aula"),
    aulas_semanais: formText(formData, "aulas_semanais"),
    dependentes_irrf: formText(formData, "dependentes_irrf"),
    ativo: formData.get("ativo"),
    cargo: formText(formData, "cargo"),
    cbo: formText(formData, "cbo"),
    aulas_manha: formText(formData, "aulas_manha"),
    aulas_tarde: formText(formData, "aulas_tarde"),
    aulas_noite: formText(formData, "aulas_noite"),
  });
  if (!parsed.success) {
    redirect(
      `/rh/folha-v2/contratos/${id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`
    );
  }
  const data_admissao = formText(formData, "data_admissao");
  const data_desligamento = formText(formData, "data_desligamento");
  const { aulas_manha, aulas_tarde, aulas_noite } = parsed.data;
  const aulas_por_turno =
    aulas_manha != null || aulas_tarde != null || aulas_noite != null
      ? { manha: aulas_manha ?? null, tarde: aulas_tarde ?? null, noite: aulas_noite ?? null }
      : null;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("folha_contratos")
    .update({
      company_id: parsed.data.company_id,
      perfil_calculo_id: parsed.data.perfil_calculo_id,
      salario_base: parsed.data.salario_base ?? null,
      valor_hora_aula: parsed.data.valor_hora_aula ?? null,
      aulas_semanais: parsed.data.aulas_semanais ?? null,
      dependentes_irrf: parsed.data.dependentes_irrf,
      data_admissao: data_admissao ?? undefined,
      data_desligamento: data_desligamento ?? null,
      ativo: parsed.data.ativo,
      cargo: parsed.data.cargo ?? null,
      cbo: parsed.data.cbo ?? null,
      aulas_por_turno,
    })
    .eq("id", id!)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) {
    redirect(
      `/rh/folha-v2/contratos/${id}/editar?erro=${encodeURIComponent(error.message)}`
    );
  }
  revalidatePath(`${REVALIDATE}/contratos`);
  redirect("/rh/folha-v2/contratos");
}

export async function createVerbaAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const parsed = verbaContratualSchema.safeParse({
    contrato_id: formText(formData, "contrato_id"),
    rubrica_id: formText(formData, "rubrica_id"),
    valor: formText(formData, "valor"),
    percentual: formText(formData, "percentual"),
    ativa: formData.get("ativa"),
  });
  if (!parsed.success) {
    const contratoId = formText(formData, "contrato_id");
    redirect(
      `/rh/folha-v2/contratos/${contratoId}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`
    );
  }
  const supabase = await createServerClient();
  const { error } = await supabase.from("folha_contratos_rubricas").insert({
    contrato_id: parsed.data.contrato_id,
    rubrica_id: parsed.data.rubrica_id,
    valor: parsed.data.valor ?? null,
    percentual: parsed.data.percentual ?? null,
    ativa: parsed.data.ativa,
  });
  if (error) {
    redirect(
      `/rh/folha-v2/contratos/${parsed.data.contrato_id}/editar?erro=${encodeURIComponent(error.message)}`
    );
  }
  revalidatePath(`${REVALIDATE}/contratos`);
}

export async function updateVerbaAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const id = formText(formData, "id");
  const contratoId = formText(formData, "contrato_id");
  if (!id) return;
  const parsed = verbaContratualSchema.safeParse({
    contrato_id: contratoId,
    rubrica_id: formText(formData, "rubrica_id"),
    valor: formText(formData, "valor"),
    percentual: formText(formData, "percentual"),
    ativa: formData.get("ativa"),
  });
  if (!parsed.success) {
    redirect(
      `/rh/folha-v2/contratos/${contratoId}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`
    );
  }
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("folha_contratos_rubricas")
    .update({
      rubrica_id: parsed.data.rubrica_id,
      valor: parsed.data.valor ?? null,
      percentual: parsed.data.percentual ?? null,
      ativa: parsed.data.ativa,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`${REVALIDATE}/contratos`);
}

export async function deleteVerbaAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("folha_contratos_rubricas")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`${REVALIDATE}/contratos`);
}

export async function updateConfigAction(formData: FormData) {
  await requirePermission(PERM, "update");
  const companyId = formText(formData, "company_id");
  if (!companyId) throw new Error("company_id obrigatório");

  const parsed = configSchema.safeParse({
    company_id: companyId,
    divisor_dsr: formText(formData, "divisor_dsr"),
    percentual_hora_atividade: formText(formData, "percentual_hora_atividade"),
    semanas_mes: formText(formData, "semanas_mes"),
  });
  if (!parsed.success) {
    redirect(
      `/rh/folha-v2/config?company_id=${companyId}&erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`
    );
  }

  const dia_fechamento = formNumber(formData, "dia_fechamento") ?? 1;
  const dia_vencimento_gps = formNumber(formData, "dia_vencimento_gps") ?? 20;
  const dia_vencimento_fgts = formNumber(formData, "dia_vencimento_fgts") ?? 20;
  const categoria_despesa_folha = formText(formData, "categoria_despesa_folha");
  const categoria_despesa_encargos = formText(formData, "categoria_despesa_encargos");
  const feriados_raw = formText(formData, "feriados_locais") ?? "";
  const feriados_locais = feriados_raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l));

  const regra_tipo = formText(formData, "regra_tipo") ?? "dia_util";
  const regra_n = formNumber(formData, "regra_n") ?? 5;

  const supabase = await createServerClient();
  const { error } = await supabase.from("folha_config").upsert(
    {
      company_id: companyId,
      escola_id: DEFAULT_SCHOOL_ID,
      divisor_dsr: parsed.data.divisor_dsr,
      percentual_hora_atividade: parsed.data.percentual_hora_atividade,
      semanas_mes: parsed.data.semanas_mes,
      dia_fechamento,
      dia_vencimento_gps,
      dia_vencimento_fgts,
      categoria_despesa_folha: categoria_despesa_folha ?? null,
      categoria_despesa_encargos: categoria_despesa_encargos ?? null,
      feriados_locais,
      regra_pagamento: { tipo: regra_tipo, n: regra_n },
    },
    { onConflict: "company_id" }
  );
  if (error) {
    redirect(
      `/rh/folha-v2/config?company_id=${companyId}&erro=${encodeURIComponent(error.message)}`
    );
  }
  revalidatePath(`${REVALIDATE}/config`);
  redirect(`/rh/folha-v2/config?company_id=${companyId}&ok=1`);
}
