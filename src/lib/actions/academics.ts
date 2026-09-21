"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formBoolean, formNumber, formText } from "@/lib/utils";
import { assertOk } from "@/lib/actions/assert-ok";
import type { ActionResult } from "@/lib/actions/types";

export async function createSerieAction(formData: FormData) {
  await requirePermission("series", "create");
  const nome = formText(formData, "nome");
  if (!nome) return;
  const supabase = await createServerClient();
  assertOk(await supabase.from("series").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    nome,
    ordem: formNumber(formData, "ordem") ?? 0
  }), "Não foi possível salvar a série");
  revalidatePath("/series");
}

export async function updateSerieAction(formData: FormData) {
  await requirePermission("series", "update");
  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  if (!id || !nome) return;

  const supabase = await createServerClient();
  await supabase
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

function turmaErrorCode(message: string): string {
  if (message.includes("turmas_escola_id_serie_id_nome_ano_letivo_turno_key")) return "duplicada";
  return "turma";
}

const TURMA_ERROR_MENSAGEM: Record<string, string> = {
  duplicada: "Já existe uma turma com essa série, nome, ano letivo e turno.",
  turma: "Erro ao salvar turma. Tente novamente.",
};

export async function createTurmaAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("turmas", "create");
  const nome = formText(formData, "nome");
  const serieId = formText(formData, "serie_id");
  if (!nome || !serieId) {
    return { ok: false, error: "Preencha nome e série." };
  }
  const supabase = await createServerClient();
  const { error } = await supabase.from("turmas").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    serie_id: serieId,
    nome,
    ano_letivo: formNumber(formData, "ano_letivo") ?? new Date().getFullYear(),
    turno: formText(formData, "turno") ?? "matutino",
    capacidade: formNumber(formData, "capacidade") ?? 30
  });
  if (error) {
    const code = turmaErrorCode(error.message);
    return { ok: false, error: TURMA_ERROR_MENSAGEM[code] ?? TURMA_ERROR_MENSAGEM.turma };
  }
  revalidatePath("/turmas");
  return { ok: true, data: undefined };
}

export async function updateTurmaAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("turmas", "update");
  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  const serieId = formText(formData, "serie_id");
  if (!id || !nome || !serieId) {
    return { ok: false, error: "Preencha nome e série." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
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

  if (error) {
    const code = turmaErrorCode(error.message);
    return { ok: false, error: TURMA_ERROR_MENSAGEM[code] ?? TURMA_ERROR_MENSAGEM.turma };
  }
  revalidatePath("/turmas");
  revalidatePath("/matriculas");
  return { ok: true, data: undefined };
}

export async function createPlanAction(formData: FormData) {
  await requirePermission("planos", "create");
  const nome = formText(formData, "nome");
  if (!nome) return;
  const supabase = await createServerClient();
  assertOk(await supabase.from("planos").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    nome,
    descricao: formText(formData, "descricao"),
    valor_matricula: formNumber(formData, "valor_matricula") ?? 0,
    valor_mensalidade: formNumber(formData, "valor_mensalidade") ?? 0,
    quantidade_parcelas: formNumber(formData, "quantidade_parcelas") ?? 12,
    dia_vencimento: formNumber(formData, "dia_vencimento") ?? 10
  }), "Não foi possível salvar o plano");
  revalidatePath("/planos");
}

export async function updatePlanAction(formData: FormData) {
  await requirePermission("planos", "update");
  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  if (!id || !nome) return;

  const supabase = await createServerClient();
  await supabase
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
  await requirePermission("matriculas", "create");
  const alunoId = formText(formData, "aluno_id");
  const serieId = formText(formData, "serie_id");
  const turmaId = formText(formData, "turma_id");
  if (!alunoId || !serieId || !turmaId) return;

  const supabase = await createServerClient();
  const planoId = formText(formData, "plano_id");
  const dataMatricula = formText(formData, "data_matricula") ?? new Date().toISOString().slice(0, 10);
  const anoLetivo = formNumber(formData, "ano_letivo") ?? new Date().getFullYear();

  // Nova matrícula sempre encerra qualquer matrícula ativa anterior do aluno
  // (mesma regra da re-matrícula) — evita duas matrículas "ativa" simultâneas.
  await supabase
    .from("matriculas")
    .update({ status: "concluida" })
    .eq("aluno_id", alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("status", "ativa");

  const { error } = await supabase.from("matriculas").insert({
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
  });

  if (error) redirect(`/matriculas?erro=matricula`);

  revalidatePath("/matriculas");
  revalidatePath("/financeiro");
  redirect(`/matriculas?sucesso=1`);
}

export async function updateEnrollmentAction(formData: FormData) {
  await requirePermission("matriculas", "update");
  const id = formText(formData, "id");
  const alunoId = formText(formData, "aluno_id");
  const serieId = formText(formData, "serie_id");
  const turmaId = formText(formData, "turma_id");
  if (!id || !alunoId || !serieId || !turmaId) return;

  const supabase = await createServerClient();
  await supabase
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
  await requirePermission("matriculas", "update");
  const id = formText(formData, "id");
  const alunoId = formText(formData, "aluno_id");
  const status = formText(formData, "status");
  if (!id || !status) return;

  const supabase = await createServerClient();
  await supabase
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
  await requirePermission("series", "update");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  await supabase
    .from("series")
    .update({ ativo: formBoolean(formData, "ativo") })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  revalidatePath("/series");
}

export async function toggleTurmaAction(formData: FormData) {
  await requirePermission("turmas", "update");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  await supabase
    .from("turmas")
    .update({ ativo: formBoolean(formData, "ativo") })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  revalidatePath("/turmas");
}

export async function togglePlanAction(formData: FormData) {
  await requirePermission("planos", "update");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  await supabase
    .from("planos")
    .update({ ativo: formBoolean(formData, "ativo") })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  revalidatePath("/planos");
}

// Cookie stores only IDs (no names) to stay well under the 4KB browser cookie limit.
// The resultado page re-fetches names from the DB.
export type RematricularLoteResultado = {
  anoDestino: number;
  ok: { novaMatriculaId: string }[];
  errors: { matriculaId: string; motivo: string }[];
};

// Mensagens da RPC rematriculate: dizem o problema e o caminho de correção.
function motivoRematricula(mensagemRpc: string, anoDestino: number): string {
  if (mensagemRpc.includes("not_found")) return "Matrícula não encontrada";
  if (mensagemRpc.includes("not_active")) return "Matrícula não está ativa";
  if (mensagemRpc.includes("already_enrolled")) return `Já possui matrícula ativa em ${anoDestino}`;
  if (mensagemRpc.includes("invalid_serie_dest")) return "Série destino não pertence a esta escola";
  if (mensagemRpc.includes("turma_dest_required")) return "Turma destino não informada";
  if (mensagemRpc.includes("invalid_turma_dest")) return "Turma destino não pertence a esta escola";
  if (mensagemRpc.includes("turma_serie_mismatch")) return "Turma destino não pertence à série destino";
  if (mensagemRpc.includes("invalid_plano_dest")) return "Plano destino não pertence a esta escola";
  if (mensagemRpc.includes("no_next_serie")) return "Não há série seguinte cadastrada";
  if (mensagemRpc.includes("violates not-null constraint")) return "Dados obrigatórios ausentes na nova matrícula";
  if (mensagemRpc.includes("violates foreign key")) return "Série, turma ou plano não existe mais";
  return "Falha ao gravar. Tente novamente ou avise o suporte.";
}

export async function rematricularLoteAction(formData: FormData) {
  await requirePermission("matriculas", "create");

  const serieDestId = formData.get("serie_dest_id") as string;
  const turmaDestId = formData.get("turma_dest_id") as string;
  // Plano é opcional: vazio grava a matrícula sem plano.
  const planoDestId = (formData.get("plano_dest_id") as string) || null;
  const anoLetivo = parseInt(formData.get("ano_letivo") as string, 10);
  const matriculaIds = formData.getAll("matricula_ids") as string[];

  const turmaId = formData.get("turma_id") as string;

  if (!serieDestId || !turmaDestId || !anoLetivo || !turmaId || matriculaIds.length === 0) {
    // Redirect back to step 3 instead of silent return
    redirect(`/matriculas/rematricula-lote?step=3&ano=${anoLetivo || ""}&turma_id=${turmaId || ""}&serie_dest_id=${serieDestId || ""}&turma_dest_id=${turmaDestId || ""}&plano_dest_id=${planoDestId || ""}`);
  }

  const supabase = await createServerClient();

  const resultado: RematricularLoteResultado = {
    anoDestino: anoLetivo + 1,
    ok: [],
    errors: [],
  };

  for (const matriculaId of matriculaIds) {
    const { data, error } = await supabase.rpc("rematriculate", {
      p_matricula_id: matriculaId,
      p_serie_dest_id: serieDestId,
      p_turma_dest_id: turmaDestId,
      p_plano_dest_id: planoDestId,
    });

    if (error) {
      resultado.errors.push({ matriculaId, motivo: motivoRematricula(error.message ?? "", anoLetivo + 1) });
    } else {
      resultado.ok.push({ novaMatriculaId: data as string });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("rematricula_lote_result", JSON.stringify(resultado), {
    maxAge: 60,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  revalidatePath("/matriculas");
  revalidatePath("/alunos");
  redirect("/matriculas/rematricula-lote/resultado");
}
