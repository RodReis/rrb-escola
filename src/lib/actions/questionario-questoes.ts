"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { substituirFilhos } from "@/lib/questionario/filhos";
import { lerLista, lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { formBoolean, formNumber } from "@/lib/utils";
import { IdSchema, QuestaoSchema, type QuestaoInput } from "@/lib/validation/questionario";

const ROTA = "/questionario/questoes";

type Cliente = Awaited<ReturnType<typeof createServerClient>>;

function lerQuestao(formData: FormData) {
  return QuestaoSchema.safeParse({
    grupoId: lerTexto(formData, "grupoId"),
    tipo: lerTexto(formData, "tipo"),
    pergunta: lerTexto(formData, "pergunta"),
    ativa: formBoolean(formData, "ativa"),
    obrigatoria: formBoolean(formData, "obrigatoria"),
    limitarCaracteres: formBoolean(formData, "limitarCaracteres"),
    qtdeCaracteres: formNumber(formData, "qtdeCaracteres") ?? 0,
    qtdeLinhas: formNumber(formData, "qtdeLinhas") ?? 0,
    alternativas: lerLista(formData, "alternativas"),
    escalaId: lerTexto(formData, "escalaId") || null,
  });
}

function colunas(q: QuestaoInput) {
  return {
    grupo_id: q.grupoId,
    tipo: q.tipo,
    pergunta: q.pergunta,
    ativa: q.ativa,
    obrigatoria: q.obrigatoria,
    limitar_caracteres: q.limitarCaracteres,
    qtde_caracteres: q.qtdeCaracteres,
    qtde_linhas: q.qtdeLinhas,
    escala_id: q.escalaId,
  };
}

/** O grupo precisa existir NESTA escola (a RLS filtra a leitura) e estar ativo, salvo se já era o da questão. */
async function validarGrupo(db: Cliente, grupoId: string, grupoAtual?: string): Promise<string | null> {
  const grupo = assertOk(
    await db.from("questao_grupos").select("id, ativo").eq("id", grupoId).maybeSingle(),
    "Não foi possível ler o grupo",
  ) as { id: string; ativo: boolean } | null;
  if (!grupo) return "Grupo inválido.";
  if (!grupo.ativo && grupo.id !== grupoAtual) return "Grupo inativo.";
  return null;
}

/** Escala padrão: existe NESTA escola (RLS) e está ativa, salvo se já era a da questão. */
async function validarEscala(db: Cliente, escalaId: string, escalaAtual?: string | null): Promise<string | null> {
  const escala = assertOk(
    await db.from("escalas").select("id, ativo").eq("id", escalaId).maybeSingle(),
    "Não foi possível ler a escala",
  ) as { id: string; ativo: boolean } | null;
  if (!escala) return "Escala inválida.";
  if (!escala.ativo && escala.id !== escalaAtual) return "Escala inativa.";
  return null;
}

export async function criarQuestaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questao", "create");
  const parsed = lerQuestao(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  const grupoInvalido = await validarGrupo(db, parsed.data.grupoId);
  if (grupoInvalido) return { ok: false, error: grupoInvalido };
  if (parsed.data.escalaId) {
    const escalaInvalida = await validarEscala(db, parsed.data.escalaId);
    if (escalaInvalida) return { ok: false, error: escalaInvalida };
  }

  const nova = assertOk(
    await db
      .from("questoes")
      .insert({ escola_id: session.profile.escola_id, ...colunas(parsed.data) })
      .select("id")
      .single(),
    "Não foi possível cadastrar a questão",
  ) as { id: string };

  if (parsed.data.alternativas.length > 0) {
    try {
      await substituirFilhos(db, "questao_alternativas", nova.id, parsed.data.alternativas);
    } catch (erro) {
      await db.from("questoes").delete().eq("id", nova.id);
      throw erro;
    }
  }

  revalidatePath(ROTA);
  return { ok: true, message: "Questão cadastrada.", redirectTo: ROTA };
}

export async function atualizarQuestaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questao", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };
  const parsed = lerQuestao(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  const atual = assertOk(
    await db.from("questoes").select("tipo, grupo_id, escala_id").eq("id", id.data).eq("escola_id", session.profile.escola_id).maybeSingle(),
    "Não foi possível ler a questão",
  ) as { tipo: string; grupo_id: string; escala_id: string | null } | null;
  if (!atual) return { ok: false, error: "Questão não encontrada." };

  if (atual.grupo_id !== parsed.data.grupoId) {
    const grupoInvalido = await validarGrupo(db, parsed.data.grupoId, atual.grupo_id);
    if (grupoInvalido) return { ok: false, error: grupoInvalido };
  }

  if (atual.tipo !== parsed.data.tipo) {
    const uso = await db
      .from("questionario_questoes")
      .select("id", { count: "exact", head: true })
      .eq("questao_id", id.data);
    assertOk(uso, "Não foi possível verificar o uso da questão");
    if ((uso.count ?? 0) > 0) {
      return { ok: false, error: "Questão em uso em questionário: não é possível trocar o tipo." };
    }
  }

  if (parsed.data.escalaId && atual.escala_id !== parsed.data.escalaId) {
    const escalaInvalida = await validarEscala(db, parsed.data.escalaId, atual.escala_id);
    if (escalaInvalida) return { ok: false, error: escalaInvalida };
  }

  assertOk(
    await db
      .from("questoes")
      .update(colunas(parsed.data))
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar a questão",
  );
  await substituirFilhos(db, "questao_alternativas", id.data, parsed.data.alternativas);

  revalidatePath(ROTA);
  return { ok: true, message: "Questão atualizada.", redirectTo: ROTA };
}

export async function alternarAtivoQuestaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questao", "update");
  const resultado = await alternarAtivo(formData, "questoes", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
