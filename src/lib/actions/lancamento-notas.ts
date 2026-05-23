"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { TITULO_NOTA_BIMESTRAL } from "@/lib/data/lancamento-notas";

export type SalvarNotaBimestralResult = { ok: true } | { ok: false; error: string };

export async function salvarNotaBimestralAction(input: {
  turmaId: string;
  disciplinaId: string;
  bimestre: number;
  matriculaId: string;
  alunoId: string;
  anoLetivo: number;
  valor: number | null;
}): Promise<SalvarNotaBimestralResult> {
  const session = await requirePermission("avaliacoes", "update");
  const supabase = await createServerClient();

  const { turmaId, disciplinaId, bimestre, matriculaId, alunoId, anoLetivo, valor } =
    input;

  if (!turmaId || !disciplinaId || !matriculaId || !alunoId) {
    return { ok: false, error: "Dados incompletos" };
  }
  if (!Number.isInteger(bimestre) || bimestre < 1 || bimestre > 4) {
    return { ok: false, error: "Bimestre inválido" };
  }

  // Validação de valor (range 0-10 por convenção, defensivo)
  if (valor !== null) {
    if (!Number.isFinite(valor)) return { ok: false, error: "Valor inválido" };
    if (valor < 0 || valor > 10) {
      return { ok: false, error: "Nota deve estar entre 0 e 10" };
    }
  }

  // 1. Resolve avaliação consolidada.
  const { data: existente, error: lookupErr } = await supabase
    .from("avaliacoes")
    .select("id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("turma_id", turmaId)
    .eq("disciplina_id", disciplinaId)
    .eq("ano_letivo", anoLetivo)
    .eq("bimestre", bimestre)
    .eq("titulo", TITULO_NOTA_BIMESTRAL)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };

  // Sem avaliação + sem valor → no-op (evita criar avaliação vazia).
  if (!existente && valor === null) return { ok: true };

  let avaliacaoId = existente?.id;

  if (!avaliacaoId) {
    const { data: nova, error: insErr } = await supabase
      .from("avaliacoes")
      .insert({
        escola_id: DEFAULT_SCHOOL_ID,
        disciplina_id: disciplinaId,
        turma_id: turmaId,
        bimestre,
        ano_letivo: anoLetivo,
        titulo: TITULO_NOTA_BIMESTRAL,
        tipo: "outro",
        peso: 1,
        valor_maximo: 10,
        criado_por: session.profile.id,
      })
      .select("id")
      .single();
    if (insErr || !nova) {
      return { ok: false, error: insErr?.message ?? "Falha ao criar avaliação" };
    }
    avaliacaoId = nova.id;
  }

  if (valor === null) {
    const { error } = await supabase
      .from("notas")
      .delete()
      .eq("avaliacao_id", avaliacaoId)
      .eq("aluno_id", alunoId);
    if (error) return { ok: false, error: error.message };
  } else {
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

  revalidatePath("/avaliacoes/lancamento");
  revalidatePath(`/alunos/${alunoId}/boletim`);
  return { ok: true };
}
