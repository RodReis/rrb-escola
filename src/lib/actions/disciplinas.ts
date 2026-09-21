"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formNumber, formText } from "@/lib/utils";
import { assertOk } from "@/lib/actions/assert-ok";

export async function createDisciplinaAction(formData: FormData) {
  await requirePermission("disciplinas", "create");
  const supabase = await createServerClient();

  const serieId = formText(formData, "serie_id");
  const nome = formText(formData, "nome");
  if (!serieId || !nome) throw new Error("Série e nome obrigatórios");

  assertOk(await supabase.from("disciplinas").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    serie_id: serieId,
    nome,
    ordem: formNumber(formData, "ordem") ?? 0,
    ativo: true,
  }), "Não foi possível salvar a disciplina");

  revalidatePath("/disciplinas");
}

export async function updateDisciplinaAction(formData: FormData) {
  await requirePermission("disciplinas", "update");
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  if (!id || !nome) throw new Error("ID e nome obrigatórios");

  await supabase
    .from("disciplinas")
    .update({
      nome,
      ordem: formNumber(formData, "ordem") ?? 0,
      ativo: formData.get("ativo") === "on",
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/disciplinas");
}

export async function deleteDisciplinaAction(formData: FormData) {
  await requirePermission("disciplinas", "delete");
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  if (!id) throw new Error("ID obrigatório");

  await supabase
    .from("disciplinas")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/disciplinas");
}

export async function createAtribuicaoAction(formData: FormData) {
  // Atribuição professor↔disciplina↔turma — gate via módulo `professores`.
  await requirePermission("professores", "create");
  const supabase = await createServerClient();

  const employeeId = formText(formData, "employee_id");
  const disciplinaId = formText(formData, "disciplina_id");
  const turmaId = formText(formData, "turma_id");
  if (!employeeId || !disciplinaId || !turmaId) throw new Error("Todos campos obrigatórios");

  assertOk(await supabase.from("professor_disciplina_turma").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    employee_id: employeeId,
    disciplina_id: disciplinaId,
    turma_id: turmaId,
  }), "Não foi possível salvar a atribuição");

  revalidatePath("/professores/atribuicoes");
}

export async function deleteAtribuicaoAction(formData: FormData) {
  await requirePermission("professores", "delete");
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  if (!id) throw new Error("ID obrigatório");

  await supabase
    .from("professor_disciplina_turma")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/professores/atribuicoes");
}

export type CriarLoteResult =
  | { ok: true; inseridos: number; ignorados: number }
  | { ok: false; error: string };

// Vincula um professor (employee) a UMA disciplina em VÁRIAS turmas de uma vez.
// Idempotente: duplicatas (unique escola/employee/disciplina/turma) são ignoradas.
export async function createAtribuicoesLoteAction(input: {
  employeeId: string;
  disciplinaId: string;
  turmaIds: string[];
}): Promise<CriarLoteResult> {
  await requirePermission("professores", "create");
  const supabase = await createServerClient();

  const { employeeId, disciplinaId, turmaIds } = input;
  if (!employeeId || !disciplinaId) return { ok: false, error: "Professor e disciplina obrigatórios" };
  if (turmaIds.length === 0) return { ok: false, error: "Selecione ao menos uma turma" };

  const { data: existentes } = await supabase
    .from("professor_disciplina_turma")
    .select("turma_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("employee_id", employeeId)
    .eq("disciplina_id", disciplinaId)
    .in("turma_id", turmaIds);

  const jaVinculadas = new Set((existentes ?? []).map((r) => r.turma_id));
  const novas = turmaIds.filter((id) => !jaVinculadas.has(id));

  if (novas.length === 0) {
    return { ok: true, inseridos: 0, ignorados: turmaIds.length };
  }

  const rows = novas.map((turma_id) => ({
    escola_id: DEFAULT_SCHOOL_ID,
    employee_id: employeeId,
    disciplina_id: disciplinaId,
    turma_id,
  }));

  const { error } = await supabase.from("professor_disciplina_turma").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/professores/atribuicoes");
  return { ok: true, inseridos: novas.length, ignorados: turmaIds.length - novas.length };
}

// Vincula um professor regente: todas disciplinas da série da turma escolhida.
// Usado para Infantil/FUND1 onde 1 professor leciona tudo na turma.
export async function createAtribuicoesRegenteAction(input: {
  employeeId: string;
  turmaId: string;
}): Promise<CriarLoteResult> {
  await requirePermission("professores", "create");
  const supabase = await createServerClient();

  const { employeeId, turmaId } = input;
  if (!employeeId || !turmaId) return { ok: false, error: "Professor e turma obrigatórios" };

  // Resolve série da turma
  const { data: turma } = await supabase
    .from("turmas")
    .select("serie_id")
    .eq("id", turmaId)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .maybeSingle();
  if (!turma) return { ok: false, error: "Turma não encontrada" };

  // Disciplinas ativas da série
  const { data: discs } = await supabase
    .from("disciplinas")
    .select("id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("serie_id", turma.serie_id)
    .eq("ativo", true);

  const disciplinaIds = (discs ?? []).map((d) => d.id);
  if (disciplinaIds.length === 0) {
    return { ok: false, error: "Esta série não tem disciplinas cadastradas" };
  }

  // Existentes
  const { data: existentes } = await supabase
    .from("professor_disciplina_turma")
    .select("disciplina_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("employee_id", employeeId)
    .eq("turma_id", turmaId)
    .in("disciplina_id", disciplinaIds);

  const ja = new Set((existentes ?? []).map((r) => r.disciplina_id));
  const novas = disciplinaIds.filter((id) => !ja.has(id));

  if (novas.length === 0) {
    return { ok: true, inseridos: 0, ignorados: disciplinaIds.length };
  }

  const rows = novas.map((disciplina_id) => ({
    escola_id: DEFAULT_SCHOOL_ID,
    employee_id: employeeId,
    disciplina_id,
    turma_id: turmaId,
  }));

  const { error } = await supabase.from("professor_disciplina_turma").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/professores/atribuicoes");
  return { ok: true, inseridos: novas.length, ignorados: disciplinaIds.length - novas.length };
}
