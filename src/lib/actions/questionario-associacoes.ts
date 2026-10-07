"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { combinarAssociacoes, unicos } from "@/lib/questionario/associacoes";
import { lerLista, lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { AssociacaoEdicaoSchema, AssociacaoLoteSchema } from "@/lib/validation/questionario";

const ROTA = "/questionario/associacoes";
// Mesma lista de candidatos de listProfessores() (src/lib/data/pedagogico.ts).
const CATEGORIAS_PROFESSOR = ["fund1", "fund2", "medio"];

type Cliente = Awaited<ReturnType<typeof createServerClient>>;

async function validarQuestionario(db: Cliente, id: string): Promise<string | null> {
  const q = assertOk(
    await db.from("questionarios").select("id, ativo").eq("id", id).maybeSingle(),
    "Não foi possível ler o questionário",
  ) as { id: string; ativo: boolean } | null;
  if (!q) return "Questionário inválido.";
  return q.ativo ? null : "Questionário inativo.";
}

async function validarTurmas(db: Cliente, ids: string[]): Promise<string | null> {
  const linhas = (assertOk(
    await db.from("turmas").select("id, nome, ativo").in("id", ids),
    "Não foi possível ler as turmas",
  ) as Array<{ id: string; nome: string; ativo: boolean }> | null) ?? [];
  if (linhas.length !== ids.length) return "Turma inválida.";
  const inativa = linhas.find((t) => !t.ativo);
  return inativa ? `A turma "${inativa.nome}" está inativa.` : null;
}

async function validarProfessor(db: Cliente, id: string): Promise<string | null> {
  const p = assertOk(
    await db
      .from("employees")
      .select("id")
      .eq("id", id)
      .in("school_category", CATEGORIAS_PROFESSOR)
      .eq("ativo", true)
      .maybeSingle(),
    "Não foi possível ler o professor",
  ) as { id: string } | null;
  return p ? null : "Professor inválido.";
}

const plural = (n: number, singular: string, pluralTxt: string) => `${n} ${n === 1 ? singular : pluralTxt}`;

export async function criarAssociacoesAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.associacao", "create");
  const parsed = AssociacaoLoteSchema.safeParse({
    questionarioId: lerTexto(formData, "questionarioId"),
    professorId: lerTexto(formData, "professorId"),
    etapas: formData.getAll("etapas").map((v) => Number(v)),
    turmaIds: lerLista(formData, "turmaIds"),
  });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const { questionarioId, professorId } = parsed.data;
  const turmaIds = unicos(parsed.data.turmaIds);
  const db = await createServerClient();
  const invalido =
    (await validarQuestionario(db, questionarioId)) ??
    (await validarTurmas(db, turmaIds)) ??
    (await validarProfessor(db, professorId));
  if (invalido) return { ok: false, error: invalido };

  const existentes = (assertOk(
    await db
      .from("questionario_associacoes")
      .select("turma_id, etapa")
      .eq("questionario_id", questionarioId)
      .eq("professor_id", professorId)
      .in("turma_id", turmaIds),
    "Não foi possível ler as associações existentes",
  ) as Array<{ turma_id: string; etapa: number }> | null) ?? [];

  const { criar, ignoradas } = combinarAssociacoes(
    parsed.data.etapas,
    turmaIds,
    existentes.map((e) => ({ turmaId: e.turma_id, etapa: e.etapa })),
  );
  if (criar.length === 0) {
    return { ok: true, message: `Nenhuma associação nova: as ${ignoradas} já existiam.` };
  }

  assertOk(
    await db.from("questionario_associacoes").insert(
      criar.map((c) => ({
        escola_id: session.profile.escola_id,
        questionario_id: questionarioId,
        professor_id: professorId,
        turma_id: c.turmaId,
        etapa: c.etapa,
      })),
    ),
    "Não foi possível criar as associações",
  );

  revalidatePath(ROTA);
  const criadas = plural(criar.length, "associação criada", "associações criadas");
  return { ok: true, message: ignoradas > 0 ? `${criadas}; ${ignoradas} já existiam.` : `${criadas}.` };
}

export async function atualizarAssociacaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.associacao", "update");
  const parsed = AssociacaoEdicaoSchema.safeParse({
    id: lerTexto(formData, "id"),
    questionarioId: lerTexto(formData, "questionarioId"),
    turmaId: lerTexto(formData, "turmaId"),
    professorId: lerTexto(formData, "professorId"),
    etapa: Number(formData.get("etapa")),
  });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const d = parsed.data;
  const db = await createServerClient();
  const atual = assertOk(
    await db
      .from("questionario_associacoes")
      .select("questionario_id, turma_id, professor_id")
      .eq("id", d.id)
      .eq("escola_id", session.profile.escola_id)
      .maybeSingle(),
    "Não foi possível ler a associação",
  ) as { questionario_id: string; turma_id: string; professor_id: string } | null;
  if (!atual) return { ok: false, error: "Associação não encontrada." };

  // Só revalida o que mudou: referência já gravada continua válida mesmo se hoje estiver inativa.
  const invalido =
    (d.questionarioId !== atual.questionario_id ? await validarQuestionario(db, d.questionarioId) : null) ??
    (d.turmaId !== atual.turma_id ? await validarTurmas(db, [d.turmaId]) : null) ??
    (d.professorId !== atual.professor_id ? await validarProfessor(db, d.professorId) : null);
  if (invalido) return { ok: false, error: invalido };

  assertOk(
    await db
      .from("questionario_associacoes")
      .update({
        questionario_id: d.questionarioId,
        turma_id: d.turmaId,
        professor_id: d.professorId,
        etapa: d.etapa,
      })
      .eq("id", d.id)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar a associação",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Associação atualizada." };
}

export async function alternarAtivoAssociacaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.associacao", "update");
  const resultado = await alternarAtivo(formData, "questionario_associacoes", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
