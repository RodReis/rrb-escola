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
