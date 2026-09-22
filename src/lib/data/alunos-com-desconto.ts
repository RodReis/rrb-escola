import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import {
  buildDescontoRow,
  type RawMatricula,
  type AlunoComDescontoRow,
  type AlunosComDescontoFilters,
} from "./alunos-com-desconto-constants";

// Re-export everything from the constants module so existing imports
// from "@/lib/data/alunos-com-desconto" keep working.
export type {
  OrigemDesconto,
  RawResponsavel,
  RawMatricula,
  AlunoComDescontoRow,
  AlunosComDescontoFilters,
} from "./alunos-com-desconto-constants";
export {
  ORIGEM_LABEL,
  origemTone,
  buildDescontoRow,
} from "./alunos-com-desconto-constants";

/**
 * Fetches active 2026 matrículas of tipo_vaga `NORMAL` or `BOLSA_50_PORCENTO` that
 * pay below the practiced value (plano below min sibling price OR BOLSA_50_PORCENTO),
 * excluding students who pay an official sibling price.
 * Sorted by série order, then student name.
 */
export async function getAlunosComDesconto(
  filters: AlunosComDescontoFilters
): Promise<AlunoComDescontoRow[]> {
  const supabase = await createServerClient();
  const anoLetivo = filters.anoLetivo ?? new Date().getFullYear();

  let query = supabase
    .from("matriculas")
    .select(`
      id, tipo_vaga, percentual_bolsa, valor_mensalidade_praticado,
      alunos!inner(id, nome, responsaveis_aluno(nome, parentesco, telefone, celular, responsavel_financeiro)),
      series!inner(id, nome, ordem, segmento),
      turmas!inner(id, nome),
      planos!inner(valor_mensalidade)
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", anoLetivo)
    .eq("status", "ativa")
    .in("tipo_vaga", ["NORMAL", "BOLSA_50_PORCENTO", "FILHO_PROFESSORA"]);

  if (filters.nome) {
    query = query.or(`nome.ilike.%${filters.nome}%`, { foreignTable: "alunos" });
  }

  const [{ data, error }, { data: valoresData, error: valErr }] = await Promise.all([
    query,
    supabase
      .from("valores_praticados")
      .select("segmento, ordem_filho, valor_mensalidade")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ano_letivo", anoLetivo)
      .order("ordem_filho", { ascending: true }),
  ]);
  if (error) throw error;
  if (valErr) throw valErr;

  const valoresPorSegmento = new Map<string, number[]>();
  for (const v of (valoresData ?? []) as Array<{
    segmento: string;
    ordem_filho: number;
    valor_mensalidade: number | string;
  }>) {
    const arr = valoresPorSegmento.get(v.segmento) ?? [];
    arr.push(Number(v.valor_mensalidade));
    valoresPorSegmento.set(v.segmento, arr);
  }

  const rows: AlunoComDescontoRow[] = [];
  for (const item of data ?? []) {
    const rec = item as unknown as RawMatricula;
    const segmento = rec.series?.segmento ?? null;
    if (!segmento) continue;
    const valoresSeg = valoresPorSegmento.get(segmento) ?? [];
    const row = buildDescontoRow(rec, valoresSeg);
    if (!row) continue;
    if (filters.serieId && row.serieId !== filters.serieId) continue;
    if (filters.turmaId && row.turmaId !== filters.turmaId) continue;
    rows.push(row);
  }

  rows.sort(
    (a, b) => a.serieOrdem - b.serieOrdem || a.nome.localeCompare(b.nome, "pt-BR")
  );
  return rows;
}
