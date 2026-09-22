"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { requirePermission } from "@/lib/auth/session";
import { formText } from "@/lib/utils";

type TipoVagaInput =
  | "NORMAL"
  | "BOLSA_50_PORCENTO"
  | "BOLSA_INTEGRAL"
  | "FILHO_PROFESSORA"
  | "FILHO_PROFESSORA_INTEGRAL"
  | "PERMUTA"
  | "ISENTO";
type StatusInput = "ativa" | "cancelada" | "transferida" | "concluida";

const TIPOS_VAGA: TipoVagaInput[] = [
  "NORMAL",
  "BOLSA_50_PORCENTO",
  "BOLSA_INTEGRAL",
  "FILHO_PROFESSORA",
  "FILHO_PROFESSORA_INTEGRAL",
  "PERMUTA",
  "ISENTO",
];
const STATUSES: StatusInput[] = ["ativa", "cancelada", "transferida", "concluida"];

function readTipoVaga(formData: FormData): TipoVagaInput {
  const raw = formText(formData, "tipo_vaga");
  return raw && (TIPOS_VAGA as string[]).includes(raw) ? (raw as TipoVagaInput) : "NORMAL";
}

function readStatus(formData: FormData): StatusInput {
  const raw = formText(formData, "status");
  return raw && (STATUSES as string[]).includes(raw) ? (raw as StatusInput) : "ativa";
}

/** BOLSA_50_PORCENTO é sempre 50% fixo; os demais tipos não têm percentual. */
function percentualBolsaFor(tipo: TipoVagaInput): number {
  return tipo === "BOLSA_50_PORCENTO" ? 50 : 0;
}

function readValorPraticado(formData: FormData): number | null {
  const raw = formData.get("valor_mensalidade_praticado");
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) return null;
  return v;
}

/**
 * Creates or updates a 2026 matrícula from the "Alunos sem valor" edit modal.
 * - matricula_id present  -> update tipo_vaga, percentual_bolsa, plano_id,
 *   serie_id, turma_id, status. Requires "matriculas" update permission.
 * - matricula_id absent   -> insert a new 2026 matrícula. Requires "matriculas"
 *   create permission. serie_id and turma_id are mandatory.
 * Never generates or recalculates cobranças.
 */
export async function upsertMatriculaSemValorAction(
  formData: FormData
): Promise<{ error?: string }> {
  const matriculaId = formText(formData, "matricula_id");
  await requirePermission("matriculas", matriculaId ? "update" : "create");

  const alunoId = formText(formData, "aluno_id");
  const serieId = formText(formData, "serie_id");
  const turmaId = formText(formData, "turma_id");
  const planoId = formText(formData, "plano_id");
  const tipoVaga = readTipoVaga(formData);
  const status = readStatus(formData);
  const percentual = percentualBolsaFor(tipoVaga);
  const valorPraticado = readValorPraticado(formData);

  if (!alunoId) return { error: "Aluno não informado." };

  const supabase = await createServerClient();

  if (matriculaId) {
    if (!serieId || !turmaId) return { error: "Série e turma são obrigatórias." };

    const { error } = await supabase
      .from("matriculas")
      .update({
        tipo_vaga: tipoVaga,
        percentual_bolsa: percentual,
        plano_id: planoId,
        serie_id: serieId,
        turma_id: turmaId,
        status,
        valor_mensalidade_praticado: valorPraticado,
      })
      .eq("id", matriculaId)
      .eq("escola_id", DEFAULT_SCHOOL_ID);
    if (error) return { error: "Erro ao atualizar a matrícula. Tente novamente." };
  } else {
    if (!serieId || !turmaId) {
      return { error: "Série e turma são obrigatórias para criar a matrícula." };
    }

    const { data: aluno, error: alunoError } = await supabase
      .from("alunos")
      .select("matricula_codigo")
      .eq("id", alunoId)
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .single();
    if (alunoError || !aluno) return { error: "Aluno não encontrado." };
    const codigo = `${aluno.matricula_codigo ?? alunoId}-2026`;

    const { error } = await supabase.from("matriculas").insert({
      escola_id: DEFAULT_SCHOOL_ID,
      aluno_id: alunoId,
      serie_id: serieId,
      turma_id: turmaId,
      plano_id: planoId,
      codigo,
      data_matricula: new Date().toISOString().slice(0, 10),
      ano_letivo: 2026,
      status: "ativa",
      tipo_vaga: tipoVaga,
      percentual_bolsa: percentual,
      valor_mensalidade_praticado: valorPraticado,
    });
    if (error) return { error: "Erro ao criar a matrícula. Tente novamente." };
  }

  revalidatePath("/financeiro/alunos-sem-valor");
  revalidatePath("/financeiro");
  revalidatePath("/matriculas");
  revalidatePath(`/alunos/${alunoId}`);
  return {};
}
