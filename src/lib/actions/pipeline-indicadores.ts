"use server";

import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/pipeline";
import type { StatusAnamnese } from "@/lib/validation/pipeline";

export type IndicadoresPipeline = {
  periodo: 30 | 90 | 180;
  captacao: {
    total: number;
    por_origem: { origem: string; total: number }[];
  };
  conversao: {
    matriculas: number;
    reservas: number;
    taxa_pct: number;
  };
  parados: {
    total: number;
    por_coluna: { coluna_id: string; coluna_nome: string; total: number }[];
  };
  tempo_medio_atendimento_dias: number | null;
  documentos_pendentes: number;
  anamneses: Partial<Record<StatusAnamnese, number>>;
  motivos_perda: { motivo: string; total: number }[];
};

export async function getIndicadoresPipeline(
  periodo: 30 | 90 | 180 = 30,
): Promise<ActionResult<IndicadoresPipeline>> {
  let session: Awaited<ReturnType<typeof requirePermission>>;
  try {
    session = await requirePermission("pipeline", "read");
  } catch {
    return { ok: false, error: "Sem permissão para acessar indicadores" };
  }

  const escola_id = session.profile.escola_id;
  const supabase = await createServerClient();

  const desde = new Date();
  desde.setDate(desde.getDate() - periodo);
  const desde_iso = desde.toISOString();

  // Todas as queries em paralelo
  const [
    captacaoRes,
    originsByOrigemRes,
    matriculasRes,
    reservasRes,
    totalCardsRes,
    paradosRes,
    tempoMedioRes,
    docPendentesRes,
    anamneseRes,
    motivosPerdaRes,
  ] = await Promise.all([
    // Total de leads criados no período
    supabase
      .from("pipeline_card")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escola_id)
      .is("deletado_em", null)
      .gte("created_at", desde_iso),

    // Leads por origem no período
    supabase
      .from("pipeline_lead")
      .select("origem, pipeline_card!inner(created_at, escola_id, deletado_em)")
      .eq("pipeline_card.escola_id", escola_id)
      .is("pipeline_card.deletado_em", null)
      .gte("pipeline_card.created_at", desde_iso),

    // Matrículas confirmadas no período (cards convertidos)
    supabase
      .from("pipeline_card")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escola_id)
      .eq("status_lead", "convertido")
      .is("deletado_em", null)
      .gte("updated_at", desde_iso),

    // Reservas criadas no período
    supabase
      .from("pipeline_reserva")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escola_id)
      .gte("created_at", desde_iso),

    // Total de cards ativos (para taxa de conversão)
    supabase
      .from("pipeline_card")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escola_id)
      .is("deletado_em", null)
      .gte("created_at", desde_iso),

    // Cards parados (sem movimentação além do prazo da coluna)
    supabase
      .from("pipeline_card")
      .select(`
        id, coluna_id, ultimo_contato_at, created_at,
        pipeline_coluna!inner(id, nome, prazo_max_dias)
      `)
      .eq("escola_id", escola_id)
      .is("deletado_em", null)
      .neq("status_lead", "convertido")
      .neq("status_lead", "perdido"),

    // Tempo médio do primeiro evento ao último (proxy: created_at → updated_at dos convertidos)
    supabase
      .from("pipeline_card")
      .select("created_at, updated_at")
      .eq("escola_id", escola_id)
      .eq("status_lead", "convertido")
      .is("deletado_em", null)
      .gte("updated_at", desde_iso),

    // Documentos pendentes (documentos_pendentes array não vazio)
    supabase
      .from("pipeline_lead")
      .select("card_id, pipeline_card!inner(escola_id, deletado_em, status_lead)")
      .eq("pipeline_card.escola_id", escola_id)
      .is("pipeline_card.deletado_em", null)
      .not("documentos_pendentes", "is", null),

    // Anamneses por status
    supabase
      .from("pipeline_anamnese")
      .select("status")
      .eq("escola_id", escola_id),

    // Motivos de perda (top 5)
    supabase
      .from("pipeline_card")
      .select("motivo_perda")
      .eq("escola_id", escola_id)
      .eq("status_lead", "perdido")
      .is("deletado_em", null)
      .not("motivo_perda", "is", null)
      .gte("updated_at", desde_iso),
  ]);

  // Processa parados
  const agora = Date.now();
  const paradosPorColuna: Record<string, { coluna_nome: string; total: number }> = {};
  let totalParados = 0;

  for (const card of paradosRes.data ?? []) {
    const coluna = card.pipeline_coluna as unknown as { id: string; nome: string; prazo_max_dias: number | null } | null;
    const prazo = coluna?.prazo_max_dias;
    if (!prazo) continue;
    const ref = (card.ultimo_contato_at as string | null) ?? (card.created_at as string);
    const dias = (agora - new Date(ref).getTime()) / 86_400_000;
    if (dias >= prazo) {
      totalParados++;
      const cid = card.coluna_id as string;
      if (!paradosPorColuna[cid]) {
        paradosPorColuna[cid] = { coluna_nome: coluna?.nome ?? cid, total: 0 };
      }
      paradosPorColuna[cid].total++;
    }
  }

  // Processa origens
  const origemMap: Record<string, number> = {};
  for (const row of originsByOrigemRes.data ?? []) {
    const origem = (row.origem as string | null) ?? "desconhecida";
    origemMap[origem] = (origemMap[origem] ?? 0) + 1;
  }

  // Processa tempo médio
  let tempoMedio: number | null = null;
  const tempoCards = tempoMedioRes.data ?? [];
  if (tempoCards.length > 0) {
    const soma = tempoCards.reduce((acc, c) => {
      const diff = new Date(c.updated_at as string).getTime() - new Date(c.created_at as string).getTime();
      return acc + diff / 86_400_000;
    }, 0);
    tempoMedio = Math.round((soma / tempoCards.length) * 10) / 10;
  }

  // Processa anamneses por status
  const anamneseMap: Partial<Record<StatusAnamnese, number>> = {};
  for (const row of anamneseRes.data ?? []) {
    const s = row.status as StatusAnamnese;
    anamneseMap[s] = (anamneseMap[s] ?? 0) + 1;
  }

  // Processa motivos de perda (top 5)
  const motivoMap: Record<string, number> = {};
  for (const row of motivosPerdaRes.data ?? []) {
    const m = (row.motivo_perda as string | null) ?? "não informado";
    motivoMap[m] = (motivoMap[m] ?? 0) + 1;
  }
  const motivosSorted = Object.entries(motivoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([motivo, total]) => ({ motivo, total }));

  // Taxa de conversão
  const totalCapt = captacaoRes.count ?? 0;
  const totalMatr = matriculasRes.count ?? 0;
  const taxaPct = totalCapt > 0 ? Math.round((totalMatr / totalCapt) * 1000) / 10 : 0;

  // Documentos pendentes: filtro de array não vazio no JS (Supabase não tem filter array length)
  const docsPendentes = (docPendentesRes.data ?? []).filter((r) => {
    const dp = (r as { documentos_pendentes?: string[] }).documentos_pendentes;
    return Array.isArray(dp) && dp.length > 0;
  }).length;

  return {
    ok: true,
    data: {
      periodo,
      captacao: {
        total: totalCapt,
        por_origem: Object.entries(origemMap)
          .sort((a, b) => b[1] - a[1])
          .map(([origem, total]) => ({ origem, total })),
      },
      conversao: {
        matriculas: totalMatr,
        reservas: reservasRes.count ?? 0,
        taxa_pct: taxaPct,
      },
      parados: {
        total: totalParados,
        por_coluna: Object.entries(paradosPorColuna).map(([coluna_id, v]) => ({
          coluna_id,
          coluna_nome: v.coluna_nome,
          total: v.total,
        })),
      },
      tempo_medio_atendimento_dias: tempoMedio,
      documentos_pendentes: docsPendentes,
      anamneses: anamneseMap,
      motivos_perda: motivosSorted,
    },
  };
}
