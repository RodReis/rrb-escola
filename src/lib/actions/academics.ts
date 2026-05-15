"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { generateChargesForEnrollment } from "@/lib/server/generate-charges";
import { createAdminClient } from "@/lib/supabase/admin";
import { formBoolean, formNumber, formText } from "@/lib/utils";

export async function createSerieAction(formData: FormData) {
  const nome = formText(formData, "nome");
  if (!nome) return;
  await createAdminClient().from("series").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    nome,
    ordem: formNumber(formData, "ordem") ?? 0
  });
  revalidatePath("/series");
}

export async function updateSerieAction(formData: FormData) {
  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  if (!id || !nome) return;

  await createAdminClient()
    .from("series")
    .update({
      nome,
      ordem: formNumber(formData, "ordem") ?? 0,
      ativo: formBoolean(formData, "ativo")
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/series");
  revalidatePath("/turmas");
  revalidatePath("/matriculas");
}

export async function createTurmaAction(formData: FormData) {
  const nome = formText(formData, "nome");
  const serieId = formText(formData, "serie_id");
  if (!nome || !serieId) return;
  await createAdminClient().from("turmas").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    serie_id: serieId,
    nome,
    ano_letivo: formNumber(formData, "ano_letivo") ?? new Date().getFullYear(),
    turno: formText(formData, "turno") ?? "matutino",
    capacidade: formNumber(formData, "capacidade") ?? 30
  });
  revalidatePath("/turmas");
}

export async function updateTurmaAction(formData: FormData) {
  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  const serieId = formText(formData, "serie_id");
  if (!id || !nome || !serieId) return;

  await createAdminClient()
    .from("turmas")
    .update({
      serie_id: serieId,
      nome,
      ano_letivo: formNumber(formData, "ano_letivo") ?? new Date().getFullYear(),
      turno: formText(formData, "turno") ?? "matutino",
      capacidade: formNumber(formData, "capacidade") ?? 30,
      ativo: formBoolean(formData, "ativo")
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/turmas");
  revalidatePath("/matriculas");
}

export async function createPlanAction(formData: FormData) {
  const nome = formText(formData, "nome");
  if (!nome) return;
  await createAdminClient().from("planos").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    nome,
    descricao: formText(formData, "descricao"),
    valor_matricula: formNumber(formData, "valor_matricula") ?? 0,
    valor_mensalidade: formNumber(formData, "valor_mensalidade") ?? 0,
    quantidade_parcelas: formNumber(formData, "quantidade_parcelas") ?? 12,
    dia_vencimento: formNumber(formData, "dia_vencimento") ?? 10
  });
  revalidatePath("/planos");
}

export async function updatePlanAction(formData: FormData) {
  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  if (!id || !nome) return;

  await createAdminClient()
    .from("planos")
    .update({
      nome,
      descricao: formText(formData, "descricao"),
      valor_matricula: formNumber(formData, "valor_matricula") ?? 0,
      valor_mensalidade: formNumber(formData, "valor_mensalidade") ?? 0,
      quantidade_parcelas: formNumber(formData, "quantidade_parcelas") ?? 12,
      dia_vencimento: formNumber(formData, "dia_vencimento") ?? 10,
      ativo: formBoolean(formData, "ativo")
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/planos");
  revalidatePath("/matriculas");
  revalidatePath("/financeiro");
}

export async function createEnrollmentAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const serieId = formText(formData, "serie_id");
  const turmaId = formText(formData, "turma_id");
  if (!alunoId || !serieId || !turmaId) return;

  const supabase = createAdminClient();
  const planoId = formText(formData, "plano_id");
  const dataMatricula = formText(formData, "data_matricula") ?? new Date().toISOString().slice(0, 10);
  const anoLetivo = formNumber(formData, "ano_letivo") ?? new Date().getFullYear();

  const { data: matricula } = await supabase.from("matriculas").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    aluno_id: alunoId,
    serie_id: serieId,
    turma_id: turmaId,
    plano_id: planoId,
    codigo: formText(formData, "codigo"),
    data_matricula: dataMatricula,
    ano_letivo: anoLetivo,
    idade_na_matricula: formNumber(formData, "idade_na_matricula"),
    status: "ativa",
    observacoes: formText(formData, "observacoes")
  }).select("id").single();

  if (matricula) {
    await generateChargesForEnrollment({
      supabase,
      escolaId: DEFAULT_SCHOOL_ID,
      alunoId,
      matriculaId: matricula.id,
      planoId,
      dataMatricula,
      anoLetivo
    });
  }

  revalidatePath("/matriculas");
  revalidatePath("/financeiro");
}

export async function updateEnrollmentAction(formData: FormData) {
  const id = formText(formData, "id");
  const alunoId = formText(formData, "aluno_id");
  const serieId = formText(formData, "serie_id");
  const turmaId = formText(formData, "turma_id");
  if (!id || !alunoId || !serieId || !turmaId) return;

  await createAdminClient()
    .from("matriculas")
    .update({
      aluno_id: alunoId,
      serie_id: serieId,
      turma_id: turmaId,
      plano_id: formText(formData, "plano_id"),
      codigo: formText(formData, "codigo"),
      data_matricula: formText(formData, "data_matricula") ?? new Date().toISOString().slice(0, 10),
      ano_letivo: formNumber(formData, "ano_letivo") ?? new Date().getFullYear(),
      idade_na_matricula: formNumber(formData, "idade_na_matricula"),
      status: formText(formData, "status") ?? "ativa",
      observacoes: formText(formData, "observacoes")
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/matriculas");
  revalidatePath(`/matriculas/${id}`);
  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function updateEnrollmentStatusAction(formData: FormData) {
  const id = formText(formData, "id");
  const alunoId = formText(formData, "aluno_id");
  const status = formText(formData, "status");
  if (!id || !status) return;

  await createAdminClient()
    .from("matriculas")
    .update({ status, observacoes: formText(formData, "observacoes") })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/matriculas");
  revalidatePath(`/matriculas/${id}`);
  if (alunoId) {
    revalidatePath(`/alunos/${alunoId}`);
    revalidatePath(`/alunos/${alunoId}/editar`);
  }
}

export async function toggleSerieAction(formData: FormData) {
  const id = formText(formData, "id");
  if (!id) return;
  await createAdminClient()
    .from("series")
    .update({ ativo: formBoolean(formData, "ativo") })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  revalidatePath("/series");
}

export async function toggleTurmaAction(formData: FormData) {
  const id = formText(formData, "id");
  if (!id) return;
  await createAdminClient()
    .from("turmas")
    .update({ ativo: formBoolean(formData, "ativo") })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  revalidatePath("/turmas");
}

export async function togglePlanAction(formData: FormData) {
  const id = formText(formData, "id");
  if (!id) return;
  await createAdminClient()
    .from("planos")
    .update({ ativo: formBoolean(formData, "ativo") })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  revalidatePath("/planos");
}
