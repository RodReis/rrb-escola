import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type SegmentoSerie = "INFANTIL" | "FUNDAMENTAL1" | "FUNDAMENTAL2" | "MEDIO";

export const SEGMENTOS: SegmentoSerie[] = ["INFANTIL", "FUNDAMENTAL1", "FUNDAMENTAL2", "MEDIO"];

export type ValorPraticado = {
  id: string;
  anoLetivo: number;
  segmento: SegmentoSerie;
  ordemFilho: 1 | 2 | 3;
  valorMatricula: number;
  valorMensalidade: number;
  observacao: string | null;
};

export async function listValoresPraticados(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<ValorPraticado[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("valores_praticados")
    .select("id, ano_letivo, segmento, ordem_filho, valor_matricula, valor_mensalidade, observacao")
    .eq("escola_id", escolaId)
    .order("ano_letivo", { ascending: false })
    .order("segmento", { ascending: true })
    .order("ordem_filho", { ascending: true });

  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    anoLetivo: r.ano_letivo,
    segmento: r.segmento as SegmentoSerie,
    ordemFilho: r.ordem_filho as 1 | 2 | 3,
    valorMatricula: Number(r.valor_matricula),
    valorMensalidade: Number(r.valor_mensalidade),
    observacao: r.observacao ?? null,
  }));
}

export async function listAnosLetivos(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<number[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("valores_praticados")
    .select("ano_letivo")
    .eq("escola_id", escolaId);

  const set = new Set<number>();
  for (const r of (data ?? []) as Array<{ ano_letivo: number }>) {
    set.add(r.ano_letivo);
  }
  return Array.from(set).sort((a, b) => b - a);
}

export async function getValorPraticado(
  anoLetivo: number,
  segmento: SegmentoSerie,
  ordemFilho: 1 | 2 | 3,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<ValorPraticado | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("valores_praticados")
    .select("id, ano_letivo, segmento, ordem_filho, valor_matricula, valor_mensalidade, observacao")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("segmento", segmento)
    .eq("ordem_filho", ordemFilho)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    anoLetivo: data.ano_letivo,
    segmento: data.segmento as SegmentoSerie,
    ordemFilho: data.ordem_filho as 1 | 2 | 3,
    valorMatricula: Number(data.valor_matricula),
    valorMensalidade: Number(data.valor_mensalidade),
    observacao: data.observacao ?? null,
  };
}
