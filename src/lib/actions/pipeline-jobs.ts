"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarWhatsApp } from "@/lib/whatsapp/send";
import type { TipoAutomacao } from "@/lib/validation/pipeline";

export type AutomacaoJobResult = {
  automacao_id: string;
  tipo: TipoAutomacao;
  cards_processados: number;
  cards_ok: number;
  erros: number;
};

type AutomacaoRow = {
  id: string;
  escola_id: string;
  quadro_id: string | null;
  coluna_id: string | null;
  tipo: TipoAutomacao;
  params: Record<string, unknown>;
};

type CardElegivel = {
  id: string;
  escola_id: string;
  coluna_id: string;
  titulo: string;
  ultimo_contato_at: string | null;
  created_at: string;
};

async function gravarExecucao(
  supabase: ReturnType<typeof createAdminClient>,
  automacao_id: string,
  card_id: string,
  escola_id: string,
  resultado: "ok" | "erro" | "ignorado",
  detalhe?: string,
  coluna_id?: string | null,
) {
  await supabase.from("pipeline_automacao_execucao").insert({
    escola_id,
    automacao_id,
    card_id,
    coluna_id: coluna_id ?? null,
    resultado,
    detalhe: detalhe ?? null,
  });
}

async function gravarAtividade(
  supabase: ReturnType<typeof createAdminClient>,
  card_id: string,
  escola_id: string,
  descricao: string,
) {
  await supabase.from("pipeline_card_atividade").insert({
    escola_id,
    card_id,
    tipo: "sistema",
    descricao,
  });
}

async function processarCardParadoCriaTarefa(
  supabase: ReturnType<typeof createAdminClient>,
  automacao: AutomacaoRow,
): Promise<{ ok: number; erros: number; processados: number }> {
  const params = automacao.params as {
    dias?: number;
    titulo: string;
    assigned_to?: string;
  };

  const diasParam = params.dias ?? null;

  // Busca cards parados além do prazo que ainda não tiveram essa automação executada
  const query = supabase
    .from("pipeline_card")
    .select(`
      id, escola_id, coluna_id, titulo, ultimo_contato_at, created_at,
      pipeline_coluna!inner(prazo_max_dias)
    `)
    .eq("escola_id", automacao.escola_id)
    .is("deletado_em", null);

  if (automacao.quadro_id) {
    query.eq("quadro_id", automacao.quadro_id);
  }

  const { data: cards } = await query;
  if (!cards?.length) return { ok: 0, erros: 0, processados: 0 };

  // Busca execuções já feitas para esta automação (dedupe por card)
  const { data: execucoes } = await supabase
    .from("pipeline_automacao_execucao")
    .select("card_id")
    .eq("automacao_id", automacao.id)
    .is("coluna_id", null);

  const jaExecutados = new Set((execucoes ?? []).map((e) => e.card_id as string));

  const agora = Date.now();
  let ok = 0;
  let erros = 0;
  let processados = 0;

  for (const card of cards) {
    if (jaExecutados.has(card.id as string)) continue;

    const coluna = (card.pipeline_coluna as unknown) as { prazo_max_dias: number | null } | null;
    const prazo = diasParam ?? coluna?.prazo_max_dias;
    if (!prazo) continue;

    const ref = card.ultimo_contato_at ?? card.created_at;
    const diasPassados = (agora - new Date(ref as string).getTime()) / 86_400_000;
    if (diasPassados < prazo) continue;

    processados++;

    try {
      const { error: tarefaErr } = await supabase.from("pipeline_tarefa").insert({
        escola_id: automacao.escola_id,
        card_id: card.id,
        titulo: params.titulo,
        assigned_to: params.assigned_to ?? null,
        created_by: "00000000-0000-0000-0000-000000000000", // sistema
        status: "aberta",
      });

      if (tarefaErr) throw new Error(tarefaErr.message);

      await Promise.all([
        gravarExecucao(supabase, automacao.id, card.id as string, automacao.escola_id, "ok"),
        gravarAtividade(
          supabase,
          card.id as string,
          automacao.escola_id,
          `Automação: tarefa "${params.titulo}" criada por inatividade de ${prazo} dias`,
        ),
      ]);
      ok++;
    } catch (e) {
      erros++;
      await gravarExecucao(
        supabase,
        automacao.id,
        card.id as string,
        automacao.escola_id,
        "erro",
        String(e),
      );
    }
  }

  return { ok, erros, processados };
}

export async function jobPipelineAutomacoes(_hoje: Date): Promise<AutomacaoJobResult[]> {
  const supabase = createAdminClient();

  // Busca apenas automações de tempo (card_parado_cria_tarefa é o único por ora)
  const { data: automacoes } = await supabase
    .from("pipeline_automacao")
    .select("id, escola_id, quadro_id, coluna_id, tipo, params")
    .eq("ativo", true)
    .in("tipo", ["card_parado_cria_tarefa"]);

  if (!automacoes?.length) return [];

  const resultados: AutomacaoJobResult[] = [];

  for (const auto of automacoes) {
    const automacao = auto as AutomacaoRow;
    let result = { ok: 0, erros: 0, processados: 0 };

    if (automacao.tipo === "card_parado_cria_tarefa") {
      result = await processarCardParadoCriaTarefa(supabase, automacao);
    }

    resultados.push({
      automacao_id: automacao.id,
      tipo: automacao.tipo,
      cards_processados: result.processados,
      cards_ok: result.ok,
      erros: result.erros,
    });
  }

  return resultados;
}
