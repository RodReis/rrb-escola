"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { montarClone } from "@/lib/questionario/clone";
import { lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import {
  diffVinculos,
  normalizarVinculos,
  type QuestaoInfo,
  type VinculoNormalizado,
} from "@/lib/questionario/vinculos";
import { formBoolean } from "@/lib/utils";
import { IdSchema, QuestionarioSchema, type QuestaoTipo } from "@/lib/validation/questionario";

const ROTA = "/questionario/questionarios";

type Cliente = Awaited<ReturnType<typeof createServerClient>>;

type Lido =
  | { ok: false; error: string }
  | {
      ok: true;
      dados: { descricao: string; observacoes: string | null; ativo: boolean };
      vinculos: VinculoNormalizado[];
      questoes: Map<string, QuestaoInfo>;
      escalas: Map<string, { descricao: string; ativo: boolean }>;
    };

/** Lê o form, valida o schema e cruza os vínculos com as questões reais do banco. */
async function lerQuestionario(db: Cliente, formData: FormData): Promise<Lido> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(lerTexto(formData, "vinculos") || "[]");
  } catch {
    return { ok: false, error: "Lista de questões inválida." };
  }

  const parsed = QuestionarioSchema.safeParse({
    descricao: lerTexto(formData, "descricao"),
    observacoes: lerTexto(formData, "observacoes"),
    ativo: formBoolean(formData, "ativo"),
    vinculos: bruto,
  });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const ids = parsed.data.vinculos.map((v) => v.questaoId);
  const linhas =
    ids.length === 0
      ? []
      : (assertOk(
          await db.from("questoes").select("id, tipo, pergunta, ativa").in("id", ids),
          "Não foi possível ler as questões",
        ) as Array<{ id: string; tipo: QuestaoTipo; pergunta: string; ativa: boolean }> | null) ?? [];
  const questoes = new Map<string, QuestaoInfo>(
    linhas.map((q) => [q.id, { tipo: q.tipo, pergunta: q.pergunta, ativa: q.ativa }]),
  );

  const normalizados = normalizarVinculos(parsed.data.vinculos, questoes);
  if (!normalizados.ok) return normalizados;

  // As escalas escolhidas precisam existir NESTA escola (a RLS filtra a leitura).
  const escalaIds = normalizados.vinculos
    .map((v) => v.escalaId)
    .filter((e): e is string => !!e)
    .filter((e, i, todas) => todas.indexOf(e) === i);
  const escalas = new Map<string, { descricao: string; ativo: boolean }>();
  if (escalaIds.length > 0) {
    const achadas = (assertOk(
      await db.from("escalas").select("id, descricao, ativo").in("id", escalaIds),
      "Não foi possível ler as escalas",
    ) as Array<{ id: string; descricao: string; ativo: boolean }> | null) ?? [];
    achadas.forEach((e) => escalas.set(e.id, { descricao: e.descricao, ativo: e.ativo }));
    if (escalaIds.some((e) => !escalas.has(e))) return { ok: false, error: "Escala inválida." };
  }

  const dados = {
    descricao: parsed.data.descricao,
    observacoes: parsed.data.observacoes,
    ativo: parsed.data.ativo,
  };
  return { ok: true, dados, vinculos: normalizados.vinculos, questoes, escalas };
}

/** Só vínculos NOVOS precisam de questão ativa (questão inativada depois continua nos antigos). */
function questaoInativaEm(novos: VinculoNormalizado[], questoes: Map<string, QuestaoInfo>): string | null {
  for (const v of novos) {
    const info = questoes.get(v.questaoId);
    if (info && !info.ativa) return `A questão "${info.pergunta}" está inativa.`;
  }
  return null;
}

/**
 * Escala inativa só passa onde já estava gravada (vínculo existente, mesma escala):
 * novo vínculo ou troca de escala exigem escala ativa.
 */
function escalaInativaEm(
  candidatos: VinculoNormalizado[],
  escalas: Map<string, { descricao: string; ativo: boolean }>,
  gravadas: Record<string, string | null>,
): string | null {
  for (const v of candidatos) {
    const escala = v.escalaId ? escalas.get(v.escalaId) : undefined;
    if (!escala || escala.ativo) continue;
    if (v.id && gravadas[v.id] === v.escalaId) continue;
    return `A escala "${escala.descricao}" está inativa.`;
  }
  return null;
}

const linhaDe = (questionarioId: string, v: VinculoNormalizado) => ({
  questionario_id: questionarioId,
  questao_id: v.questaoId,
  escala_id: v.escalaId,
  ordem: v.ordem,
});

export async function criarQuestionarioAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questionario", "create");
  const db = await createServerClient();
  const lido = await lerQuestionario(db, formData);
  if (!lido.ok) return lido;
  const inativa =
    questaoInativaEm(lido.vinculos, lido.questoes) ?? escalaInativaEm(lido.vinculos, lido.escalas, {});
  if (inativa) return { ok: false, error: inativa };

  const novo = assertOk(
    await db
      .from("questionarios")
      .insert({ escola_id: session.profile.escola_id, ...lido.dados })
      .select("id")
      .single(),
    "Não foi possível cadastrar o questionário",
  ) as { id: string };

  if (lido.vinculos.length > 0) {
    try {
      assertOk(
        await db.from("questionario_questoes").insert(lido.vinculos.map((v) => linhaDe(novo.id, v))),
        "Não foi possível salvar as questões do questionário",
      );
    } catch (erro) {
      await db.from("questionarios").delete().eq("id", novo.id);
      throw erro;
    }
  }

  revalidatePath(ROTA);
  return { ok: true, message: "Questionário cadastrado.", redirectTo: ROTA };
}

export async function atualizarQuestionarioAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questionario", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };

  const db = await createServerClient();
  const lido = await lerQuestionario(db, formData);
  if (!lido.ok) return lido;

  const atuais = (assertOk(
    await db
      .from("questionario_questoes")
      .select("id, questao_id, escala_id")
      .eq("questionario_id", id.data),
    "Não foi possível ler as questões do questionário",
  ) as Array<{ id: string; questao_id: string; escala_id: string | null }> | null) ?? [];
  const diff = diffVinculos(
    atuais.map((a) => ({ id: a.id, questaoId: a.questao_id })),
    lido.vinculos,
  );

  const gravadas: Record<string, string | null> = {};
  atuais.forEach((a) => {
    gravadas[a.id] = a.escala_id;
  });
  const inativa =
    questaoInativaEm(diff.inserir, lido.questoes) ??
    escalaInativaEm(diff.inserir.concat(diff.atualizar), lido.escalas, gravadas);
  if (inativa) return { ok: false, error: inativa };

  assertOk(
    await db
      .from("questionarios")
      .update(lido.dados)
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar o questionário",
  );

  // Inserir/atualizar ANTES de remover: se um passo falhar, o questionário fica com
  // vínculos a mais (o usuário refaz), nunca com questões perdidas. A unicidade
  // (questionario, questao) não conflita: diffVinculos reaproveita a linha da mesma questão.
  if (diff.inserir.length > 0) {
    assertOk(
      await db.from("questionario_questoes").insert(diff.inserir.map((v) => linhaDe(id.data, v))),
      "Não foi possível adicionar questões ao questionário",
    );
  }
  if (diff.atualizar.length > 0) {
    assertOk(
      await db
        .from("questionario_questoes")
        .upsert(diff.atualizar.map((v) => ({ id: v.id, ...linhaDe(id.data, v) })), { onConflict: "id" }),
      "Não foi possível atualizar as questões do questionário",
    );
  }
  if (diff.remover.length > 0) {
    assertOk(
      await db.from("questionario_questoes").delete().in("id", diff.remover),
      "Não foi possível remover questões do questionário",
    );
  }

  revalidatePath(ROTA);
  return { ok: true, message: "Questionário atualizado.", redirectTo: ROTA };
}

export async function alternarAtivoQuestionarioAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questionario", "update");
  const resultado = await alternarAtivo(formData, "questionarios", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export async function clonarQuestionarioAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questionario", "create");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };

  const db = await createServerClient();
  const origem = assertOk(
    await db
      .from("questionarios")
      .select("descricao, observacoes")
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id)
      .maybeSingle(),
    "Não foi possível ler o questionário",
  ) as { descricao: string; observacoes: string | null } | null;
  if (!origem) return { ok: false, error: "Questionário não encontrado." };

  const vinculos = (assertOk(
    await db
      .from("questionario_questoes")
      .select("questao_id, escala_id, ordem")
      .eq("questionario_id", id.data)
      .order("ordem"),
    "Não foi possível ler as questões do questionário",
  ) as Array<{ questao_id: string; escala_id: string | null; ordem: number }> | null) ?? [];

  const clone = montarClone(origem, vinculos);
  const novo = assertOk(
    await db
      .from("questionarios")
      .insert({ escola_id: session.profile.escola_id, ...clone.questionario })
      .select("id")
      .single(),
    "Não foi possível clonar o questionário",
  ) as { id: string };

  if (clone.vinculos.length > 0) {
    try {
      assertOk(
        await db
          .from("questionario_questoes")
          .insert(clone.vinculos.map((v) => ({ questionario_id: novo.id, ...v }))),
        "Não foi possível copiar as questões",
      );
    } catch (erro) {
      await db.from("questionarios").delete().eq("id", novo.id);
      throw erro;
    }
  }

  revalidatePath(ROTA);
  return {
    ok: true,
    message: "Questionário clonado (inativo). Revise e ative.",
    redirectTo: `${ROTA}/${novo.id}/editar`,
  };
}
