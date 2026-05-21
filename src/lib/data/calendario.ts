import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { Calendario, CalendarioExcecao, CalendarioComExcecoes } from "@/lib/calendario/types";

function mapCalendario(row: any): Calendario {
  return {
    id: row.id,
    escolaId: row.escola_id,
    anoLetivo: row.ano_letivo,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    diasSemanaLetivos: row.dias_semana_letivos ?? [],
  };
}

function mapExcecao(row: any): CalendarioExcecao {
  return {
    id: row.id,
    calendarioId: row.calendario_id,
    escolaId: row.escola_id,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    tipo: row.tipo,
    descricao: row.descricao,
  };
}

export async function getCalendario(
  anoLetivo: number,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<CalendarioComExcecoes | null> {
  const supabase = await createServerClient();

  const { data: calRow } = await supabase
    .from("calendario_letivo")
    .select("*")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .maybeSingle();

  if (!calRow) return null;

  const calendario = mapCalendario(calRow);

  const { data: exRows } = await supabase
    .from("calendario_excecoes")
    .select("*")
    .eq("calendario_id", calendario.id)
    .order("data_inicio", { ascending: true });

  return {
    calendario,
    excecoes: (exRows ?? []).map(mapExcecao),
  };
}

export async function listAnosLetivos(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<number[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("calendario_letivo")
    .select("ano_letivo")
    .eq("escola_id", escolaId)
    .order("ano_letivo", { ascending: false });
  return (data ?? []).map((r: any) => r.ano_letivo);
}

// Feriados/recessos do mês corrente e do próximo. Em dezembro o próximo mês
// cai no ano seguinte — busca os dois calendários quando necessário.
export async function getFeriadosProximos(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<CalendarioExcecao[]> {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth(); // 0-11

  const inicio = `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-01`;
  // último dia do próximo mês
  const fimDate = new Date(Date.UTC(anoAtual, mesAtual + 2, 0));
  const fim = `${fimDate.getUTCFullYear()}-${String(fimDate.getUTCMonth() + 1).padStart(2, "0")}-${String(fimDate.getUTCDate()).padStart(2, "0")}`;

  const supabase = await createServerClient();

  // Anos a consultar: ano atual e, se a janela cruzar o ano, o seguinte.
  const anos = anoAtual === fimDate.getUTCFullYear() ? [anoAtual] : [anoAtual, anoAtual + 1];

  const { data: calRows } = await supabase
    .from("calendario_letivo")
    .select("id")
    .eq("escola_id", escolaId)
    .in("ano_letivo", anos);

  const calIds = (calRows ?? []).map((r: any) => r.id);
  if (calIds.length === 0) return [];

  const { data: exRows } = await supabase
    .from("calendario_excecoes")
    .select("*")
    .in("calendario_id", calIds)
    .gte("data_inicio", inicio)
    .lte("data_inicio", fim)
    .order("data_inicio", { ascending: true });

  return (exRows ?? []).map(mapExcecao);
}
