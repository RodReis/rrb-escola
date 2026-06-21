"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  criarCardSchema,
  editarCardSchema,
  moverCardSchema,
  notaSchema,
  reservaSchema,
  quadroSchema,
  colunaAdminSchema,
  templateWppSchema,
  tarefaSchema,
  FONTES_WPP,
  type CriarCardInput,
  type EditarCardInput,
  type MoverCardInput,
  type NotaInput,
  type ReservaInput,
  type QuadroInput,
  type ColunaAdminInput,
  type TemplateWppInput,
  type TarefaInput,
  type FonteWpp,
} from "@/lib/validation/pipeline";
import { enviarWhatsApp } from "@/lib/whatsapp/send";
import { normalizarTelefone } from "@/lib/whatsapp/telefone";

const PATH = "/pipeline";

// ─── Tipos de retorno ────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getPipelineCtx() {
  const session = await requirePermission("pipeline", "read");
  return {
    session,
    escola_id: session.profile.escola_id,
    usuario_id: session.profile.id,
  };
}

async function getAdminCtx() {
  const session = await requirePermission("pipeline_admin", "read");
  return {
    session,
    escola_id: session.profile.escola_id,
    usuario_id: session.profile.id,
  };
}

// ─── Buscar quadro + colunas + cards ─────────────────────────────────────────

export async function getPipelineBoard(quadro_id: string) {
  let ctx: Awaited<ReturnType<typeof getPipelineCtx>>;
  try {
    ctx = await getPipelineCtx();
  } catch {
    return { ok: false, error: "Sem permissão" } as const;
  }
  const { escola_id } = ctx;

  const supabase = await createServerClient();

  const [quadroRes, colunasRes, cardsRes] = await Promise.all([
    supabase
      .from("pipeline_quadro")
      .select("id, nome, tipo")
      .eq("id", quadro_id)
      .eq("escola_id", escola_id)
      .single(),
    supabase
      .from("pipeline_coluna")
      .select("id, nome, cor, ordem, etapa_final, prazo_max_dias")
      .eq("quadro_id", quadro_id)
      .eq("escola_id", escola_id)
      .order("ordem"),
    supabase
      .from("pipeline_card")
      .select(`
        id, coluna_id, ordem, titulo, origem, status_lead,
        assigned_to, ultimo_contato_at, created_at,
        pipeline_lead(nome, data_nascimento)
      `)
      .eq("quadro_id", quadro_id)
      .eq("escola_id", escola_id)
      .order("ordem"),
  ]);

  if (quadroRes.error) return { ok: false, error: quadroRes.error.message } as const;
  if (colunasRes.error) return { ok: false, error: colunasRes.error.message } as const;
  if (cardsRes.error) return { ok: false, error: cardsRes.error.message } as const;

  // Mapa coluna_id → prazo_max_dias
  const prazoMap = new Map<string, number | null>(
    (colunasRes.data ?? []).map((col) => [col.id, col.prazo_max_dias ?? null]),
  );

  const agora = Date.now();

  // Supabase retorna joins como array; normalizar pipeline_lead para objeto
  const cards = (cardsRes.data ?? []).map((c) => {
    const lead = Array.isArray(c.pipeline_lead)
      ? (c.pipeline_lead[0] ?? null)
      : c.pipeline_lead ?? null;

    const prazo = prazoMap.get(c.coluna_id) ?? null;
    const refDate = c.ultimo_contato_at ?? c.created_at;
    const diasSemContato = (agora - new Date(refDate).getTime()) / 86400000;
    const sem_resposta = prazo !== null && diasSemContato > prazo;

    return {
      ...c,
      sem_resposta,
      pipeline_lead: lead as { nome: string; data_nascimento: string | null } | null,
    };
  });

  // Colunas sem prazo_max_dias no tipo PipelineColuna — manter compatibilidade
  const colunas = (colunasRes.data ?? []).map(({ prazo_max_dias: _, ...col }) => col);

  return {
    ok: true,
    data: {
      quadro: quadroRes.data,
      colunas,
      cards,
    },
  } as const;
}

export async function getPrimeiroQuadro() {
  let escola_id: string | null = null;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return null;
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("pipeline_quadro")
    .select("id")
    .eq("escola_id", escola_id)
    .eq("ativo", true)
    .order("ordem")
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

// ─── Criar card ───────────────────────────────────────────────────────────────

export async function criarCardAction(
  input: CriarCardInput,
): Promise<ActionResult<{ id: string }>> {
  let ctx: Awaited<ReturnType<typeof getPipelineCtx>>;
  try {
    ctx = await getPipelineCtx();
  } catch {
    return { ok: false, error: "Sem permissão" };
  }
  const { escola_id, usuario_id } = ctx;

  const parsed = criarCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const { quadro_id, coluna_id, titulo, origem, status_lead, assigned_to, lead, responsaveis } =
    parsed.data;

  const supabase = await createServerClient();

  const { data: ultimoCard } = await supabase
    .from("pipeline_card")
    .select("ordem")
    .eq("coluna_id", coluna_id)
    .eq("escola_id", escola_id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ordem = ultimoCard ? ultimoCard.ordem + 1 : 1;

  const { data: card, error: cardErr } = await supabase
    .from("pipeline_card")
    .insert({ escola_id, quadro_id, coluna_id, ordem, titulo, origem, status_lead, assigned_to })
    .select("id")
    .single();

  if (cardErr || !card) return { ok: false, error: cardErr?.message ?? "Erro ao criar card" };

  const card_id = card.id;

  const [leadErr, respErr] = await Promise.all([
    supabase
      .from("pipeline_lead")
      .insert({ escola_id, card_id, ...lead })
      .then((r) => r.error),
    supabase
      .from("pipeline_lead_responsavel")
      .insert(responsaveis.map((r) => ({ escola_id, card_id, ...r })))
      .then((r) => r.error),
  ]);

  if (leadErr) return { ok: false, error: leadErr.message };
  if (respErr) return { ok: false, error: respErr.message };

  await supabase.from("pipeline_card_atividade").insert({
    escola_id,
    card_id,
    tipo: "sistema",
    descricao: "Card criado",
    usuario_id,
  });

  revalidatePath(PATH);
  return { ok: true, data: { id: card_id } };
}

// ─── Editar card ──────────────────────────────────────────────────────────────

export async function editarCardAction(
  card_id: string,
  input: EditarCardInput,
): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = editarCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();
  const { error: upErr } = await supabase
    .from("pipeline_card")
    .update(parsed.data)
    .eq("id", card_id)
    .eq("escola_id", escola_id);

  if (upErr) return { ok: false, error: upErr.message };

  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

// ─── Excluir card ─────────────────────────────────────────────────────────────

export async function excluirCardAction(card_id: string): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { error: delErr } = await supabase
    .from("pipeline_card")
    .delete()
    .eq("id", card_id)
    .eq("escola_id", escola_id);

  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

// ─── Mover card ───────────────────────────────────────────────────────────────

export async function moverCardAction(
  input: MoverCardInput,
): Promise<ActionResult> {
  let ctx: Awaited<ReturnType<typeof getPipelineCtx>>;
  try {
    ctx = await getPipelineCtx();
  } catch {
    return { ok: false, error: "Sem permissão" };
  }
  const { escola_id, usuario_id } = ctx;

  const parsed = moverCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const { card_id, para_coluna_id, nova_ordem, observacao } = parsed.data;

  const supabase = await createServerClient();

  const { data: cardAtual, error: fetchErr } = await supabase
    .from("pipeline_card")
    .select("coluna_id")
    .eq("id", card_id)
    .eq("escola_id", escola_id)
    .single();

  if (fetchErr || !cardAtual) return { ok: false, error: fetchErr?.message ?? "Card não encontrado" };

  const de_coluna_id = cardAtual.coluna_id;

  const [updateErr, movErr] = await Promise.all([
    supabase
      .from("pipeline_card")
      .update({ coluna_id: para_coluna_id, ordem: nova_ordem })
      .eq("id", card_id)
      .eq("escola_id", escola_id)
      .then((r) => r.error),
    supabase
      .from("pipeline_card_movimentacao")
      .insert({
        escola_id,
        card_id,
        de_coluna_id: de_coluna_id !== para_coluna_id ? de_coluna_id : null,
        para_coluna_id,
        usuario_id,
        observacao,
      })
      .then((r) => r.error),
  ]);

  if (updateErr) return { ok: false, error: updateErr.message };
  if (movErr) return { ok: false, error: movErr.message };

  if (de_coluna_id !== para_coluna_id) {
    await supabase
      .from("pipeline_card")
      .update({ ultimo_contato_at: new Date().toISOString() })
      .eq("id", card_id)
      .eq("escola_id", escola_id);
  }

  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

// ─── Criar nota ───────────────────────────────────────────────────────────────

export async function criarNotaAction(
  input: NotaInput,
): Promise<ActionResult<{ id: string }>> {
  let ctx: Awaited<ReturnType<typeof getPipelineCtx>>;
  try {
    ctx = await getPipelineCtx();
  } catch {
    return { ok: false, error: "Sem permissão" };
  }
  const { escola_id, usuario_id } = ctx;

  const parsed = notaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();

  const { data, error: insErr } = await supabase
    .from("pipeline_card_atividade")
    .insert({
      escola_id,
      card_id: parsed.data.card_id,
      tipo: parsed.data.tipo,
      descricao: parsed.data.descricao,
      usuario_id,
      anexo_url: parsed.data.anexo_url,
    })
    .select("id")
    .single();

  if (insErr || !data) return { ok: false, error: insErr?.message ?? "Erro ao criar nota" };

  await supabase
    .from("pipeline_card")
    .update({ ultimo_contato_at: new Date().toISOString() })
    .eq("id", parsed.data.card_id)
    .eq("escola_id", escola_id);

  revalidatePath(PATH);
  return { ok: true, data: { id: data.id } };
}

// ─── Buscar timeline do card ──────────────────────────────────────────────────

export async function getTimelineCard(card_id: string) {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" } as const;
  }

  const supabase = await createServerClient();

  const [movRes, atividadeRes] = await Promise.all([
    supabase
      .from("pipeline_card_movimentacao")
      .select(`
        id, created_at, observacao,
        de_coluna:de_coluna_id(nome),
        para_coluna:para_coluna_id(nome),
        usuario:usuario_id(nome)
      `)
      .eq("card_id", card_id)
      .eq("escola_id", escola_id)
      .order("created_at"),
    supabase
      .from("pipeline_card_atividade")
      .select(`
        id, tipo, descricao, created_at, anexo_url,
        usuario:usuario_id(nome)
      `)
      .eq("card_id", card_id)
      .eq("escola_id", escola_id)
      .order("created_at"),
  ]);

  if (movRes.error) return { ok: false, error: movRes.error.message } as const;
  if (atividadeRes.error) return { ok: false, error: atividadeRes.error.message } as const;

  return {
    ok: true,
    data: {
      movimentacoes: movRes.data,
      atividades: atividadeRes.data,
    },
  } as const;
}

// ─── Buscar detalhe do card (lead + responsáveis + reserva) ──────────────────

export async function getCardDetalhe(card_id: string) {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" } as const;
  }

  const supabase = await createServerClient();

  const [cardRes, leadRes, respRes, reservaRes] = await Promise.all([
    supabase
      .from("pipeline_card")
      .select("id, titulo, origem, status_lead, assigned_to, ultimo_contato_at, motivo_perda, created_at, coluna_id, aluno_id")
      .eq("id", card_id)
      .eq("escola_id", escola_id)
      .single(),
    supabase
      .from("pipeline_lead")
      .select("*")
      .eq("card_id", card_id)
      .eq("escola_id", escola_id)
      .maybeSingle(),
    supabase
      .from("pipeline_lead_responsavel")
      .select("*")
      .eq("card_id", card_id)
      .eq("escola_id", escola_id)
      .order("created_at"),
    supabase
      .from("pipeline_reserva")
      .select("*, series(nome), turmas(nome, capacidade)")
      .eq("card_id", card_id)
      .eq("escola_id", escola_id)
      .maybeSingle(),
  ]);

  if (cardRes.error) return { ok: false, error: cardRes.error.message } as const;

  return {
    ok: true,
    data: {
      card: cardRes.data,
      lead: leadRes.data,
      responsaveis: respRes.data ?? [],
      reserva: reservaRes.data ?? null,
    },
  } as const;
}

// ─── Buscar usuários da escola (para assigned_to) ────────────────────────────

export async function getUsuariosDaEscola() {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return [];
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("perfis")
    .select("id, nome")
    .eq("escola_id", escola_id)
    .eq("ativo", true)
    .order("nome");

  return data ?? [];
}

// ─── Editar lead (dados educacionais MVP2) ────────────────────────────────────

export async function editarLeadAction(
  card_id: string,
  data: {
    escola_anterior?: string | null;
    motivo_transferencia?: string | null;
    situacao_escolar?: string | null;
    observacoes_pedagogicas?: string | null;
  },
): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_lead")
    .update(data)
    .eq("card_id", card_id)
    .eq("escola_id", escola_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

// ─── Reserva ─────────────────────────────────────────────────────────────────

export async function criarOuAtualizarReservaAction(
  card_id: string,
  input: Omit<ReservaInput, "prioridade"> & { prioridade?: number },
): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = reservaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_reserva")
    .upsert(
      { card_id, escola_id, ...parsed.data },
      { onConflict: "card_id" },
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

export async function getVagasTurma(
  turma_id: string,
  ano_letivo: number,
): Promise<ActionResult<{ capacidade: number; matriculas_ativas: number; vagas_restantes: number }>> {
  try {
    await getPipelineCtx();
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("pipeline_turma_vagas", { p_turma_id: turma_id, p_ano_letivo: ano_letivo })
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Turma não encontrada" };

  return {
    ok: true,
    data: {
      capacidade: Number((data as { capacidade: number }).capacidade),
      matriculas_ativas: Number((data as { matriculas_ativas: number }).matriculas_ativas),
      vagas_restantes: Number((data as { vagas_restantes: number }).vagas_restantes),
    },
  };
}

export async function getSeriesEscola(): Promise<ActionResult<Array<{ id: string; nome: string; ordem: number }>>> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("series")
    .select("id, nome, ordem")
    .eq("escola_id", escola_id)
    .order("ordem");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function getTurmasPorSerie(
  serie_id: string,
): Promise<ActionResult<Array<{ id: string; nome: string; capacidade: number | null }>>> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("turmas")
    .select("id, nome, capacidade")
    .eq("serie_id", serie_id)
    .eq("escola_id", escola_id)
    .order("nome");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

// ─── Promoção lead → aluno/matrícula ─────────────────────────────────────────

export async function promoverCardAction(
  card_id: string,
): Promise<ActionResult<{ matricula_codigo: string }>> {
  let usuario_id: string;
  try {
    const ctx = await getAdminCtx();
    await requirePermission("pipeline_admin", "create");
    usuario_id = ctx.usuario_id;
  } catch {
    return { ok: false, error: "Sem permissão para promover" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("pipeline_promover_card", {
      p_card_id: card_id,
      p_usuario_id: usuario_id,
    })
    .single();

  if (error) return { ok: false, error: error.message };

  const result = data as { ok: boolean; error?: string; data?: { matricula_codigo: string } };
  if (!result.ok) return { ok: false, error: result.error ?? "Erro ao promover" };

  revalidatePath(PATH);
  revalidatePath("/alunos");
  return { ok: true, data: { matricula_codigo: result.data?.matricula_codigo ?? "" } };
}

// ─── Quadros (admin) ─────────────────────────────────────────────────────────

export async function getQuadrosEscola(): Promise<ActionResult<Array<{
  id: string; nome: string; tipo: string; ordem: number; ativo: boolean; descricao: string | null;
}>>> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_quadro")
    .select("id, nome, tipo, ordem, ativo, descricao")
    .eq("escola_id", escola_id)
    .order("ordem");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function criarQuadroAction(input: QuadroInput): Promise<ActionResult<{ id: string }>> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    await requirePermission("pipeline_admin", "create");
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = quadroSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_quadro")
    .insert({ escola_id, ...parsed.data })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao criar quadro" };

  revalidatePath("/pipeline/config");
  return { ok: true, data: { id: data.id } };
}

export async function editarQuadroAction(
  quadro_id: string,
  input: QuadroInput,
): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    await requirePermission("pipeline_admin", "update");
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = quadroSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_quadro")
    .update(parsed.data)
    .eq("id", quadro_id)
    .eq("escola_id", escola_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/pipeline/config");
  return { ok: true, data: undefined };
}

export async function arquivarQuadroAction(quadro_id: string): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    await requirePermission("pipeline_admin", "update");
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_quadro")
    .update({ ativo: false })
    .eq("id", quadro_id)
    .eq("escola_id", escola_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/pipeline/config");
  return { ok: true, data: undefined };
}

// ─── Colunas (admin) ─────────────────────────────────────────────────────────

export async function getColunasQuadro(quadro_id: string): Promise<ActionResult<Array<{
  id: string; nome: string; cor: string | null; ordem: number; etapa_final: boolean; prazo_max_dias: number | null;
}>>> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_coluna")
    .select("id, nome, cor, ordem, etapa_final, prazo_max_dias")
    .eq("quadro_id", quadro_id)
    .eq("escola_id", escola_id)
    .order("ordem");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function criarColunaAction(
  quadro_id: string,
  input: ColunaAdminInput,
): Promise<ActionResult<{ id: string }>> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    await requirePermission("pipeline_admin", "create");
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = colunaAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_coluna")
    .insert({ escola_id, quadro_id, ...parsed.data })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao criar coluna" };

  revalidatePath(`/pipeline/config/${quadro_id}`);
  return { ok: true, data: { id: data.id } };
}

export async function editarColunaAction(
  coluna_id: string,
  input: ColunaAdminInput,
): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    await requirePermission("pipeline_admin", "update");
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = colunaAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_coluna")
    .update(parsed.data)
    .eq("id", coluna_id)
    .eq("escola_id", escola_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

export async function excluirColunaAction(coluna_id: string): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    await requirePermission("pipeline_admin", "delete");
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();

  // Bloqueia exclusão se há cards na coluna
  const { count } = await supabase
    .from("pipeline_card")
    .select("id", { count: "exact", head: true })
    .eq("coluna_id", coluna_id)
    .eq("escola_id", escola_id);

  if (count && count > 0) {
    return { ok: false, error: `Coluna possui ${count} card(s). Mova os cards antes de excluir.` };
  }

  const { error } = await supabase
    .from("pipeline_coluna")
    .delete()
    .eq("id", coluna_id)
    .eq("escola_id", escola_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

export async function reordenarColunasAction(
  ordens: Array<{ id: string; ordem: number }>,
): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    await requirePermission("pipeline_admin", "update");
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();

  const updates = await Promise.all(
    ordens.map(({ id, ordem }) =>
      supabase
        .from("pipeline_coluna")
        .update({ ordem })
        .eq("id", id)
        .eq("escola_id", escola_id)
        .then((r) => r.error),
    ),
  );

  const firstError = updates.find(Boolean);
  if (firstError) return { ok: false, error: firstError.message };

  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

// ─── MVP3: Templates WhatsApp ─────────────────────────────────────────────────

export type TemplateWpp = {
  id: string;
  nome_template: string;
  descricao: string;
  variaveis_count: number;
  variaveis_fontes: FonteWpp[];
  ativo: boolean;
};

export async function getTemplatesWhatsapp(): Promise<ActionResult<TemplateWpp[]>> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_template_whatsapp")
    .select("id, nome_template, descricao, variaveis_count, variaveis_fontes, ativo")
    .eq("escola_id", escola_id)
    .eq("ativo", true)
    .order("descricao");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as TemplateWpp[] };
}

export async function getTemplatesWhatsappAdmin(): Promise<ActionResult<TemplateWpp[]>> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_template_whatsapp")
    .select("id, nome_template, descricao, variaveis_count, variaveis_fontes, ativo")
    .eq("escola_id", escola_id)
    .order("descricao");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as TemplateWpp[] };
}

export async function criarTemplateWppAction(input: TemplateWppInput): Promise<ActionResult<{ id: string }>> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = templateWppSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_template_whatsapp")
    .insert({ escola_id, ...parsed.data })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao criar template" };

  revalidatePath("/pipeline/config");
  return { ok: true, data: { id: data.id } };
}

export async function editarTemplateWppAction(
  template_id: string,
  input: TemplateWppInput,
): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = templateWppSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_template_whatsapp")
    .update(parsed.data)
    .eq("id", template_id)
    .eq("escola_id", escola_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/pipeline/config");
  return { ok: true, data: undefined };
}

export async function arquivarTemplateWppAction(template_id: string): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getAdminCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_template_whatsapp")
    .update({ ativo: false })
    .eq("id", template_id)
    .eq("escola_id", escola_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/pipeline/config");
  return { ok: true, data: undefined };
}

// ─── MVP3: Envio WhatsApp por card ───────────────────────────────────────────

function resolverVariavel(
  fonte: FonteWpp,
  ctx: {
    leadNome: string;
    respNome: string;
    respWhatsapp: string | null;
    escolaNome: string;
    hoje: string;
  },
): string {
  switch (fonte) {
    case "lead.nome": return ctx.leadNome;
    case "lead.responsavel.nome": return ctx.respNome;
    case "lead.responsavel.whatsapp": return ctx.respWhatsapp ?? "";
    case "escola.nome": return ctx.escolaNome;
    case "hoje": return ctx.hoje;
    case "campo_livre": return "";
  }
}

export async function enviarWhatsappCardAction(
  card_id: string,
  template_id: string,
  variaveis_override: string[],
): Promise<ActionResult> {
  let escola_id: string;
  let usuario_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
    usuario_id = ctx.usuario_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();

  const [templateRes, cardRes, escolaRes] = await Promise.all([
    supabase
      .from("pipeline_template_whatsapp")
      .select("id, nome_template, descricao, variaveis_count, variaveis_fontes")
      .eq("id", template_id)
      .eq("escola_id", escola_id)
      .single(),
    supabase
      .from("pipeline_card")
      .select("id, pipeline_lead(nome), pipeline_lead_responsavel(nome, whatsapp, telefone)")
      .eq("id", card_id)
      .eq("escola_id", escola_id)
      .single(),
    supabase.from("escolas").select("nome").eq("id", escola_id).single(),
  ]);

  if (templateRes.error || !templateRes.data) return { ok: false, error: "Template não encontrado" };
  if (cardRes.error || !cardRes.data) return { ok: false, error: "Card não encontrado" };

  const template = templateRes.data;
  const lead = Array.isArray(cardRes.data.pipeline_lead)
    ? cardRes.data.pipeline_lead[0]
    : cardRes.data.pipeline_lead;
  const responsaveis = Array.isArray(cardRes.data.pipeline_lead_responsavel)
    ? cardRes.data.pipeline_lead_responsavel
    : cardRes.data.pipeline_lead_responsavel
      ? [cardRes.data.pipeline_lead_responsavel]
      : [];
  const resp = responsaveis[0] ?? null;
  const escolaNome = escolaRes.data?.nome ?? "Escola";

  const telefone = resp?.whatsapp ?? resp?.telefone ?? null;
  if (!telefone || !normalizarTelefone(telefone)) {
    return { ok: false, error: "Responsável sem WhatsApp/telefone válido" };
  }

  const hoje = new Date().toLocaleDateString("pt-BR");
  const resolveCtx = {
    leadNome: (lead as { nome: string } | null)?.nome ?? "",
    respNome: resp?.nome ?? "",
    respWhatsapp: resp?.whatsapp ?? resp?.telefone ?? null,
    escolaNome,
    hoje,
  };

  const fontes = (template.variaveis_fontes ?? []) as FonteWpp[];
  const variaveis = Array.from({ length: template.variaveis_count as number }, (_, i) => {
    const override = variaveis_override[i];
    if (override !== undefined && override !== "") return override;
    const fonte = fontes[i] ?? "campo_livre";
    return resolverVariavel(fonte, resolveCtx);
  });

  const resultado = await enviarWhatsApp(
    {
      telefone,
      templateName: template.nome_template as string,
      variaveis,
      textoLog: template.descricao as string,
      referenciaTipo: "pipeline_card",
      referenciaId: card_id,
    },
    supabase,
  );

  const statusDesc = resultado.ok ? "enviado" : `falha: ${resultado.reason}`;

  await Promise.all([
    supabase.from("pipeline_card_atividade").insert({
      escola_id,
      card_id,
      tipo: "whatsapp",
      descricao: `${template.descricao} — ${statusDesc}`,
      usuario_id,
    }),
    supabase
      .from("pipeline_card")
      .update({ ultimo_contato_at: new Date().toISOString() })
      .eq("id", card_id)
      .eq("escola_id", escola_id),
  ]);

  revalidatePath(PATH);

  if (!resultado.ok) return { ok: false, error: `Envio falhou: ${resultado.reason}` };
  return { ok: true, data: undefined };
}

// ─── MVP3: Tarefas ───────────────────────────────────────────────────────────

export type Tarefa = {
  id: string;
  card_id: string;
  titulo: string;
  descricao: string | null;
  due_at: string | null;
  status: string;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  perfil_assigned?: { nome: string } | null;
};

export async function getTarefasCard(card_id: string): Promise<ActionResult<Tarefa[]>> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_tarefa")
    .select("id, card_id, titulo, descricao, due_at, status, assigned_to, created_by, created_at, completed_at, perfil_assigned:perfis!assigned_to(nome)")
    .eq("card_id", card_id)
    .eq("escola_id", escola_id)
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as unknown as Tarefa[] };
}

export async function criarTarefaAction(
  card_id: string,
  input: TarefaInput,
): Promise<ActionResult> {
  let escola_id: string;
  let usuario_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
    usuario_id = ctx.usuario_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = tarefaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validação inválida" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_tarefa")
    .insert({ escola_id, card_id, created_by: usuario_id, ...parsed.data });

  if (error) return { ok: false, error: error.message };

  if (parsed.data.assigned_to) {
    await supabase.from("notificacoes").insert({
      escola_id,
      perfil_id: parsed.data.assigned_to,
      tipo: "pipeline_tarefa_atribuida",
      titulo: "Nova tarefa atribuída",
      descricao: parsed.data.titulo,
      href: "/pipeline",
      severidade: "info",
    });
  }

  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

export async function concluirTarefaAction(tarefa_id: string): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_tarefa")
    .update({ status: "concluida", completed_at: new Date().toISOString() })
    .eq("id", tarefa_id)
    .eq("escola_id", escola_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

export async function cancelarTarefaAction(tarefa_id: string): Promise<ActionResult> {
  let escola_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pipeline_tarefa")
    .update({ status: "cancelada" })
    .eq("id", tarefa_id)
    .eq("escola_id", escola_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true, data: undefined };
}

// ─── MVP3: Notificações de tarefa vencida (sob demanda) ──────────────────────

export async function checkTarefasVencidasAction(): Promise<void> {
  let escola_id: string;
  let usuario_id: string;
  try {
    const ctx = await getPipelineCtx();
    escola_id = ctx.escola_id;
    usuario_id = ctx.usuario_id;
  } catch {
    return;
  }

  const supabase = await createServerClient();
  const agora = new Date().toISOString();

  const { data: vencidas } = await supabase
    .from("pipeline_tarefa")
    .select("id, titulo, card_id")
    .eq("escola_id", escola_id)
    .eq("assigned_to", usuario_id)
    .eq("status", "aberta")
    .lt("due_at", agora);

  if (!vencidas?.length) return;

  for (const t of vencidas) {
    const { count } = await supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escola_id)
      .eq("perfil_id", usuario_id)
      .eq("tipo", "pipeline_tarefa_vencida")
      .eq("lida", false)
      .like("href", `%${t.card_id}%`);

    if (!count) {
      await supabase.from("notificacoes").insert({
        escola_id,
        perfil_id: usuario_id,
        tipo: "pipeline_tarefa_vencida",
        titulo: "Tarefa vencida",
        descricao: t.titulo,
        href: "/pipeline",
        severidade: "atencao",
      });
    }
  }
}
