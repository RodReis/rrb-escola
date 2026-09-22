/**
 * Pure types, constants, and functions for the "alunos com desconto" feature.
 * This file is safe to import in both Server and Client Components.
 * Do NOT add any server-only imports (e.g. next/headers, supabase server) here.
 */

export type OrigemDesconto = "plano" | "bolsa_50" | "plano+bolsa";

export type RawResponsavel = {
  nome: string;
  parentesco: string | null;
  telefone: string | null;
  celular: string | null;
  responsavel_financeiro: boolean;
};

export type RawMatricula = {
  id: string;
  tipo_vaga: "NORMAL" | "BOLSA_50_PORCENTO" | "FILHO_PROFESSORA";
  percentual_bolsa: number;
  valor_mensalidade_praticado: number | null;
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
  anoLetivo?: number;
};

export const ORIGEM_LABEL: Record<OrigemDesconto, string> = {
  plano: "Plano",
  bolsa_50: "Bolsa 50%",
  "plano+bolsa": "Plano + Bolsa 50%",
};

export function origemTone(origem: OrigemDesconto): "neutral" | "warning" | "danger" {
  if (origem === "plano") return "neutral";
  if (origem === "bolsa_50") return "warning";
  return "danger";
}

/**
 * Decides whether the matrícula qualifies as "with discount" and computes the row.
 *
 * Rules (in order):
 *   1. No plano / no segmento / empty valoresSeg -> null.
 *   2. If plano value matches ANY ordem_filho value AND tipo_vaga !== BOLSA_50_PORCENTO -> null
 *      (paying official sibling price, not a discount).
 *   3. Enters if tipo_vaga === BOLSA_50_PORCENTO OR plano value < min(valoresSeg).
 *   4. Origem combines plano and bolsa.
 *   5. valorEfetivo applies the fixed 50% to the plan.
 *
 * `valoresSeg` MUST start with the ordem_filho=1 value (caller orders it).
 */
export function buildDescontoRow(
  raw: RawMatricula,
  valoresSeg: number[]
): AlunoComDescontoRow | null {
  // Valor cobrado: prioriza valor_mensalidade_praticado da matrícula, fallback ao plano.
  const valorPraticadoMatricula = raw.valor_mensalidade_praticado;
  const valorPlano = raw.planos?.valor_mensalidade;
  const valorCobrado = valorPraticadoMatricula != null && Number(valorPraticadoMatricula) > 0
    ? Number(valorPraticadoMatricula)
    : valorPlano != null ? Number(valorPlano) : null;
  if (valorCobrado == null) return null;
  if (!raw.series?.segmento) return null;
  if (valoresSeg.length === 0) return null;

  const valorCobradoNum = valorCobrado;
  // Defensive: idempotent for numbers; converts any leaked Postgres numeric strings.
  const valoresSegNum = valoresSeg.map(Number);
  const minSeg = Math.min(...valoresSegNum);
  const isBolsa50 = raw.tipo_vaga === "BOLSA_50_PORCENTO" || raw.tipo_vaga === "FILHO_PROFESSORA";

  const bateValorOficial = valoresSegNum.some((v) => v === valorCobradoNum);
  if (bateValorOficial && !isBolsa50) return null;

  const temDescontoPlano = valorCobradoNum < minSeg;
  if (!temDescontoPlano && !isBolsa50) return null;

  const origem: OrigemDesconto =
    temDescontoPlano && isBolsa50
      ? "plano+bolsa"
      : temDescontoPlano
      ? "plano"
      : "bolsa_50";

  // Quando valor_mensalidade_praticado está setado, ele já é o valor final cobrado
  // (sem aplicar bolsa%). Bolsa só se aplica quando caímos no fallback do plano.
  const valorEfetivo = isBolsa50 && valorPraticadoMatricula == null
    ? valorCobradoNum * (1 - raw.percentual_bolsa / 100)
    : valorCobradoNum;

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
    valorMensalidadePlano: valorCobradoNum,
    percentualBolsaParcial: isBolsa50 ? raw.percentual_bolsa : 0,
    percentualDescontoEfetivo,
    responsavelNome: resp?.nome ?? null,
    responsavelParentesco: resp?.parentesco ?? null,
    responsavelTelefone: respTel,
  };
}
