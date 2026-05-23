import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type EventoEscola = {
  id: string;
  escolaId: string;
  titulo: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;
  descricao: string | null;
  local: string | null;
};

type RawEvento = {
  id: string;
  escola_id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  descricao: string | null;
  local: string | null;
};

function mapEvento(row: RawEvento): EventoEscola {
  return {
    id: row.id,
    escolaId: row.escola_id,
    titulo: row.titulo,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    descricao: row.descricao,
    local: row.local,
  };
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getEventos(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<EventoEscola[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("eventos_escola")
    .select("*")
    .eq("escola_id", escolaId)
    .order("data_inicio", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapEvento);
}

export async function getEventoById(
  id: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<EventoEscola | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("eventos_escola")
    .select("*")
    .eq("id", id)
    .eq("escola_id", escolaId)
    .maybeSingle();
  return data ? mapEvento(data as RawEvento) : null;
}

// Eventos que ainda não terminaram (data_fim >= hoje), ordenado por data_inicio asc.
export async function getEventosProximos(
  escolaId: string = DEFAULT_SCHOOL_ID,
  limit: number = 5,
): Promise<EventoEscola[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("eventos_escola")
    .select("*")
    .eq("escola_id", escolaId)
    .gte("data_fim", todayIso())
    .order("data_inicio", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapEvento);
}
