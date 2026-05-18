"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formNumber, formText } from "@/lib/utils";

const TIPOS = ["prova", "trabalho", "participacao", "simulado", "outro"] as const;

function readTipo(formData: FormData): (typeof TIPOS)[number] {
  const raw = formText(formData, "tipo");
  if (raw && (TIPOS as readonly string[]).includes(raw)) return raw as (typeof TIPOS)[number];
  return "prova";
}

export async function createAvaliacaoAction(formData: FormData) {
  const session = await requireSession();
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

  await supabase.from("avaliacoes").insert({
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
  });

  revalidatePath("/avaliacoes");
}

export async function updateAvaliacaoAction(formData: FormData) {
  await requireSession();
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
  await requireSession();
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
  const session = await requireSession();
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
  await supabase.from("notas").upsert(rows, { onConflict: "avaliacao_id,aluno_id" });

  revalidatePath(`/avaliacoes/${avaliacaoId}`);
  revalidatePath("/avaliacoes");
}
