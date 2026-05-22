import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type TipoVaga = "paga" | "bolsa_integral" | "bolsa_parcial" | "permuta" | "gratuita";

export type MotivoSemValor =
  | "sem_valor"
  | "bolsa_integral"
  | "bolsa_parcial"
  | "permuta"
  | "gratuita";

export type RawResponsavel = {
  nome: string;
  parentesco: string | null;
  telefone: string | null;
  celular: string | null;
  responsavel_financeiro: boolean;
};

export type RawMatricula = {
  id: string;
  tipo_vaga: TipoVaga;
  plano_id: string | null;
  alunos: { id: string; nome: string } | null;
  planos: { valor_matricula: number | null } | null;
  turmas: {
    id: string;
    nome: string;
    series: { id: string; nome: string; ordem: number } | null;
  } | null;
  responsaveis_aluno: RawResponsavel[];
};

export type ResponsavelRow = {
  nome: string;
  parentesco: string | null;
  telefone: string;
};

export type AlunoSemValorRow = {
  matriculaId: string;
  nome: string;
  serie: string;
  serieOrdem: number;
  turma: string;
  motivo: MotivoSemValor;
  valorMatricula: number;
  responsaveis: ResponsavelRow[];
};

export type AlunosSemValorFilters = {
  nome: string | null;
  motivo: MotivoSemValor | null;
  serieId: string | null;
  turmaId: string | null;
};

export const MOTIVO_LABEL: Record<MotivoSemValor, string> = {
  sem_valor: "Sem valor",
  bolsa_integral: "Bolsa integral",
  bolsa_parcial: "Bolsa parcial",
  permuta: "Permuta",
  gratuita: "Gratuita",
};

export function motivoTone(motivo: MotivoSemValor): "danger" | "warning" | "neutral" {
  if (motivo === "sem_valor") return "danger";
  if (motivo === "bolsa_integral" || motivo === "bolsa_parcial") return "warning";
  return "neutral";
}

/** True when the matrícula has no defined value: no plan, or plan value is 0/null. */
export function isSemValor(planoId: string | null, valorMatricula: number | null): boolean {
  if (!planoId) return true;
  return valorMatricula == null || valorMatricula <= 0;
}

/**
 * Returns the Motivo for a matrícula, or null if it should NOT appear in the grid.
 * Precedence: tipo_vaga (non-paga) wins over sem_valor — a scholarship without a
 * plan is expected, not a registration error.
 */
export function deriveMotivo(
  tipoVaga: TipoVaga,
  planoId: string | null,
  valorMatricula: number | null
): MotivoSemValor | null {
  if (tipoVaga !== "paga") return tipoVaga;
  if (isSemValor(planoId, valorMatricula)) return "sem_valor";
  return null;
}

/** Builds an AlunoSemValorRow from a raw joined matrícula, or null if it should not appear. */
export function buildRow(raw: RawMatricula): AlunoSemValorRow | null {
  const valor = raw.planos?.valor_matricula ?? null;
  const motivo = deriveMotivo(raw.tipo_vaga, raw.plano_id, valor);
  if (!motivo) return null;

  const responsaveis: ResponsavelRow[] = [...raw.responsaveis_aluno]
    .sort((a, b) => Number(b.responsavel_financeiro) - Number(a.responsavel_financeiro))
    .map((r) => ({
      nome: r.nome,
      parentesco: r.parentesco,
      telefone: r.celular || r.telefone || "",
    }));

  return {
    matriculaId: raw.id,
    nome: raw.alunos?.nome ?? "—",
    serie: raw.turmas?.series?.nome ?? "—",
    serieOrdem: raw.turmas?.series?.ordem ?? 9999,
    turma: raw.turmas?.nome ?? "—",
    motivo,
    valorMatricula: valor ?? 0,
    responsaveis,
  };
}

/**
 * Fetches active 2026 matrículas that have no normal matrícula value
 * (incomplete registration) or are non-paying (scholarship/permuta/gratuita).
 * Sorted by série order, then student name.
 */
export async function getAlunosSemValor(
  filters: AlunosSemValorFilters
): Promise<AlunoSemValorRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("matriculas")
    .select(`
      id, tipo_vaga, plano_id,
      alunos!inner(id, nome, responsaveis_aluno(nome, parentesco, telefone, celular, responsavel_financeiro)),
      planos(valor_matricula),
      turmas!inner(id, nome, serie_id, series!inner(id, nome, ordem))
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", 2026)
    .eq("status", "ativa");

  if (filters.nome) {
    query = query.or(`nome.ilike.%${filters.nome}%`, { foreignTable: "alunos" });
  }
  if (filters.turmaId) {
    query = query.eq("turma_id", filters.turmaId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows: AlunoSemValorRow[] = [];
  for (const item of data ?? []) {
    const alunoNode = (item as Record<string, unknown>).alunos as
      | { id: string; nome: string; responsaveis_aluno?: RawResponsavel[] }
      | null;
    const raw: RawMatricula = {
      id: (item as { id: string }).id,
      tipo_vaga: (item as { tipo_vaga: TipoVaga }).tipo_vaga,
      plano_id: (item as { plano_id: string | null }).plano_id,
      alunos: alunoNode ? { id: alunoNode.id, nome: alunoNode.nome } : null,
      planos: (item as unknown as { planos: { valor_matricula: number | null } | null }).planos,
      turmas: (item as unknown as { turmas: RawMatricula["turmas"] }).turmas,
      responsaveis_aluno: alunoNode?.responsaveis_aluno ?? [],
    };
    if (filters.serieId && raw.turmas?.series?.id !== filters.serieId) continue;
    const row = buildRow(raw);
    if (!row) continue;
    if (filters.motivo && row.motivo !== filters.motivo) continue;
    rows.push(row);
  }

  rows.sort(
    (a, b) => a.serieOrdem - b.serieOrdem || a.nome.localeCompare(b.nome, "pt-BR")
  );
  return rows;
}
