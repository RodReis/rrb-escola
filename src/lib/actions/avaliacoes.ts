"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formNumber, formText } from "@/lib/utils";
import { assertOk } from "@/lib/actions/assert-ok";

const TIPOS = ["prova", "trabalho", "participacao", "simulado", "outro"] as const;

function readTipo(formData: FormData): (typeof TIPOS)[number] {
  const raw = formText(formData, "tipo");
  if (raw && (TIPOS as readonly string[]).includes(raw)) return raw as (typeof TIPOS)[number];
  return "prova";
}

export async function createAvaliacaoAction(formData: FormData) {
  const session = await requirePermission("avaliacoes", "create");
  const supabase = await createServerClient();

  const disciplinaId = formText(formData, "disciplina_id");
  const turmaId = formText(formData, "turma_id");
  const titulo = formText(formData, "titulo");
  const bimestre = formNumber(formData, "bimestre");
  const anoLetivo = formNumber(formData, "ano_letivo") ?? new Date().getFullYear();
  const peso = formNumber(formData, "peso") ?? 1;
  const valorMaximo = formNumber(formData, "valor_maximo") ?? 10;

  if (!disciplinaId || !turmaId || !titulo || !bimestre) {
    throw new Error("Disciplina, turma, título e bimestre são obrigatórios");
  }
  if (bimestre < 1 || bimestre > 4) throw new Error("Bimestre deve ser 1-4");

  assertOk(await supabase.from("avaliacoes").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    disciplina_id: disciplinaId,
    turma_id: turmaId,
    bimestre,
    ano_letivo: anoLetivo,
    titulo,
    tipo: readTipo(formData),
    peso,
    valor_maximo: valorMaximo,
    data_aplicacao: formText(formData, "data_aplicacao"),
    criado_por: session.profile.id,
  }), "Não foi possível criar a avaliação");

  revalidatePath("/avaliacoes");
}

export async function updateAvaliacaoAction(formData: FormData) {
  await requirePermission("avaliacoes", "update");
  const supabase = await createServerClient();
  const id = formText(formData, "id");
  if (!id) throw new Error("ID obrigatório");

  const titulo = formText(formData, "titulo");
  const bimestre = formNumber(formData, "bimestre");
  if (!titulo || !bimestre) throw new Error("Título e bimestre obrigatórios");

  await supabase
    .from("avaliacoes")
    .update({
      titulo,
      bimestre,
      tipo: readTipo(formData),
      peso: formNumber(formData, "peso") ?? 1,
      valor_maximo: formNumber(formData, "valor_maximo") ?? 10,
      data_aplicacao: formText(formData, "data_aplicacao"),
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/avaliacoes");
  revalidatePath(`/avaliacoes/${id}`);
}

export async function deleteAvaliacaoAction(formData: FormData) {
  await requirePermission("avaliacoes", "delete");
  const supabase = await createServerClient();
  const id = formText(formData, "id");
  if (!id) throw new Error("ID obrigatório");

  await supabase
    .from("avaliacoes")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/avaliacoes");
}

export async function lancarNotasAction(formData: FormData) {
  // Lançamento de notas — gate como `update` em avaliações.
  const session = await requirePermission("avaliacoes", "update");
  const supabase = await createServerClient();

  const avaliacaoId = formText(formData, "avaliacao_id");
  if (!avaliacaoId) throw new Error("Avaliação obrigatória");

  // Entradas: pra cada matrícula, FormData tem "nota_<matriculaId>" e "aluno_<matriculaId>"
  const rows: Array<{
    escola_id: string;
    avaliacao_id: string;
    aluno_id: string;
    matricula_id: string;
    valor: number | null;
    lancada_por: string;
  }> = [];

  for (const [key, value] of Array.from(formData.entries())) {
    if (!key.startsWith("nota_")) continue;
    const matriculaId = key.slice("nota_".length);
    const alunoId = formText(formData, `aluno_${matriculaId}`);
    if (!alunoId) continue;

    const raw = typeof value === "string" ? value.trim() : "";
    const valor = raw === "" ? null : Number(raw.replace(",", "."));
    if (valor !== null && !Number.isFinite(valor)) continue;

    rows.push({
      escola_id: DEFAULT_SCHOOL_ID,
      avaliacao_id: avaliacaoId,
      aluno_id: alunoId,
      matricula_id: matriculaId,
      valor,
      lancada_por: session.profile.id,
    });
  }

  if (rows.length === 0) return;

  // Upsert por (avaliacao_id, aluno_id)
  assertOk(
    await supabase.from("notas").upsert(rows, { onConflict: "avaliacao_id,aluno_id" }),
    "Não foi possível salvar as notas",
  );

  revalidatePath(`/avaliacoes/${avaliacaoId}`);
  revalidatePath("/avaliacoes");
}

export type SalvarNotaInlineResult = { ok: true } | { ok: false; error: string };

// Autosave de uma única nota (chamada da UI inline).
export async function salvarNotaInlineAction(input: {
  avaliacaoId: string;
  matriculaId: string;
  alunoId: string;
  valor: number | null;
}): Promise<SalvarNotaInlineResult> {
  const session = await requirePermission("avaliacoes", "update");
  const supabase = await createServerClient();

  const { avaliacaoId, matriculaId, alunoId, valor } = input;
  if (!avaliacaoId || !matriculaId || !alunoId) {
    return { ok: false, error: "Dados incompletos" };
  }

  // Carrega valor_maximo para validar range.
  const { data: aval } = await supabase
    .from("avaliacoes")
    .select("valor_maximo, escola_id")
    .eq("id", avaliacaoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .maybeSingle();
  if (!aval) return { ok: false, error: "Avaliação não encontrada" };

  if (valor === null) {
    const { error } = await supabase
      .from("notas")
      .delete()
      .eq("avaliacao_id", avaliacaoId)
      .eq("aluno_id", alunoId);
    if (error) return { ok: false, error: error.message };
  } else {
    if (!Number.isFinite(valor)) return { ok: false, error: "Valor inválido" };
    if (valor < 0 || valor > Number(aval.valor_maximo)) {
      return { ok: false, error: `Nota deve estar entre 0 e ${aval.valor_maximo}` };
    }
    const { error } = await supabase.from("notas").upsert(
      {
        escola_id: DEFAULT_SCHOOL_ID,
        avaliacao_id: avaliacaoId,
        aluno_id: alunoId,
        matricula_id: matriculaId,
        valor,
        lancada_por: session.profile.id,
      },
      { onConflict: "avaliacao_id,aluno_id" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/avaliacoes/${avaliacaoId}`);
  revalidatePath(`/alunos/${alunoId}/boletim`);
  return { ok: true };
}
