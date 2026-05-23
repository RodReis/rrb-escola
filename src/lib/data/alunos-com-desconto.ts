import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

/**
 * Types, constants, pure functions, and server query for the "alunos com desconto" feature.
 * This file is server-only (imports "server-only").
 * Client Components must import only from the constants module directly if needed.
 */

export type OrigemDesconto = "plano" | "bolsa_parcial" | "plano+bolsa";

export type RawResponsavel = {
  nome: string;
  parentesco: string | null;
  telefone: string | null;
  celular: string | null;
  responsavel_financeiro: boolean;
};

export type RawMatricula = {
  id: string;
  tipo_vaga: "paga" | "bolsa_parcial";
  percentual_bolsa: number;
  alunos: {
    id: string;
    nome: string;
    responsaveis_aluno: RawResponsavel[];
  } | null;
  series: {
    id: string;
    nome: string;
    ordem: number;
    segmento: string | null;
  } | null;
  turmas: { id: string; nome: string } | null;
  planos: { valor_mensalidade: number | null } | null;
};

export type AlunoComDescontoRow = {
  alunoId: string;
  matriculaId: string;
  nome: string;
  serie: string;
  serieId: string;
  serieOrdem: number;
  turma: string;
  turmaId: string;
  segmento: string;
  origem: OrigemDesconto;
  valorPraticadoCheio: number;
  valorMensalidadePlano: number;
  percentualBolsaParcial: number;
  percentualDescontoEfetivo: number;
  responsavelNome: string | null;
  responsavelParentesco: string | null;
  responsavelTelefone: string | null;
};

export type AlunosComDescontoFilters = {
  nome: string | null;
  serieId: string | null;
  turmaId: string | null;
};

export const ORIGEM_LABEL: Record<OrigemDesconto, string> = {
  plano: "Plano",
  bolsa_parcial: "Bolsa parcial",
  "plano+bolsa": "Plano + Bolsa parcial",
};

export function origemTone(origem: OrigemDesconto): "neutral" | "warning" | "danger" {
  if (origem === "plano") return "neutral";
  if (origem === "bolsa_parcial") return "warning";
  return "danger";
}

/**
 * Decides whether the matrícula qualifies as "with discount" and computes the row.
 *
 * Rules (in order):
 *   1. No plano / no segmento / empty valoresSeg -> null.
 *   2. If plano value matches ANY ordem_filho value AND tipo_vaga !== bolsa_parcial -> null
 *      (paying official sibling price, not a discount).
 *   3. Enters if tipo_vaga === bolsa_parcial OR plano value < min(valoresSeg).
 *   4. Origem combines plano and bolsa.
 *   5. valorEfetivo applies the bolsa percentual to the plan; percentual is clamped to [0, 1].
 *
 * `valoresSeg` MUST start with the ordem_filho=1 value (caller orders it).
 */
export function buildDescontoRow(
  raw: RawMatricula,
  valoresSeg: number[]
): AlunoComDescontoRow | null {
  const valorPlano = raw.planos?.valor_mensalidade;
  if (valorPlano == null) return null;
  if (!raw.series?.segmento) return null;
  if (valoresSeg.length === 0) return null;

  const valorPlanoNum = Number(valorPlano);
  // Defensive: idempotent for numbers; converts any leaked Postgres numeric strings.
  const valoresSegNum = valoresSeg.map(Number);
  const minSeg = Math.min(...valoresSegNum);
  // 0% and 100% on a bolsa_parcial vaga are data-quality anomalies (missing or
  // invalid percentage); we treat them as "not a valid partial scholarship" so
  // they fall through to the plano-discount check instead of dividing by zero
  // or producing degenerate efetivo math.
  const isBolsaParcial =
    raw.tipo_vaga === "bolsa_parcial" &&
    raw.percentual_bolsa > 0 &&
    raw.percentual_bolsa < 100;

  const bateValorOficial = valoresSegNum.some((v) => v === valorPlanoNum);
  if (bateValorOficial && !isBolsaParcial) return null;

  const temDescontoPlano = valorPlanoNum < minSeg;
  if (!temDescontoPlano && !isBolsaParcial) return null;

  const origem: OrigemDesconto =
    temDescontoPlano && isBolsaParcial
      ? "plano+bolsa"
      : temDescontoPlano
      ? "plano"
      : "bolsa_parcial";

  const valorEfetivo = isBolsaParcial
    ? valorPlanoNum * (1 - raw.percentual_bolsa / 100)
    : valorPlanoNum;

  const valorPraticadoCheio = valoresSegNum[0];
  const percentualDescontoEfetivo = Math.max(
    0,
    1 - valorEfetivo / valorPraticadoCheio
  );

  const responsaveis = [...(raw.alunos?.responsaveis_aluno ?? [])].sort(
    (a, b) => Number(b.responsavel_financeiro) - Number(a.responsavel_financeiro)
  );
  const resp = responsaveis[0] ?? null;
  const respTel = resp ? resp.celular || resp.telefone || null : null;

  return {
    alunoId: raw.alunos?.id ?? "",
    matriculaId: raw.id,
    nome: raw.alunos?.nome ?? "—",
    serie: raw.series.nome,
    serieId: raw.series.id,
    serieOrdem: raw.series.ordem,
    turma: raw.turmas?.nome ?? "—",
    turmaId: raw.turmas?.id ?? "",
    segmento: raw.series.segmento,
    origem,
    valorPraticadoCheio,
    valorMensalidadePlano: valorPlanoNum,
    percentualBolsaParcial: isBolsaParcial ? raw.percentual_bolsa : 0,
    percentualDescontoEfetivo,
    responsavelNome: resp?.nome ?? null,
    responsavelParentesco: resp?.parentesco ?? null,
    responsavelTelefone: respTel,
  };
}

/**
 * Fetches active 2026 matrículas of tipo_vaga `paga` or `bolsa_parcial` that
 * pay below the practiced value (plano below min sibling price OR bolsa_parcial),
 * excluding students who pay an official sibling price.
 * Sorted by série order, then student name.
 */
export async function getAlunosComDesconto(
  filters: AlunosComDescontoFilters
): Promise<AlunoComDescontoRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("matriculas")
    .select(`
      id, tipo_vaga, percentual_bolsa,
      alunos!inner(id, nome, responsaveis_aluno(nome, parentesco, telefone, celular, responsavel_financeiro)),
      series!inner(id, nome, ordem, segmento),
      turmas!inner(id, nome),
      planos!inner(valor_mensalidade)
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", 2026)
    .eq("status", "ativa")
    .in("tipo_vaga", ["paga", "bolsa_parcial"]);

  if (filters.nome) {
    query = query.or(`nome.ilike.%${filters.nome}%`, { foreignTable: "alunos" });
  }

  const { data, error } = await query;
  if (error) throw error;

  // Load all practiced values for 2026 and index by segmento (ordered by ordem_filho ASC).
  const { data: valoresData, error: valErr } = await supabase
    .from("valores_praticados")
    .select("segmento, ordem_filho, valor_mensalidade")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", 2026)
    .order("ordem_filho", { ascending: true });
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
