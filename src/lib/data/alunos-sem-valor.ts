import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { buildRow, deriveMotivo, isSemValor, type RawMatricula, type TipoVaga } from "./alunos-sem-valor-constants";

// Re-export everything so existing imports from this file continue to work.
export type {
  TipoVaga,
  MotivoSemValor,
  RawResponsavel,
  RawMatricula,
  ResponsavelRow,
  AlunoSemValorRow,
  AlunosSemValorFilters,
} from "./alunos-sem-valor-constants";
export {
  MOTIVO_LABEL,
  motivoTone,
  isSemValor,
  deriveMotivo,
  buildRow,
} from "./alunos-sem-valor-constants";

/**
 * Fetches active 2026 matrículas that have no normal matrícula value
 * (incomplete registration) or are non-paying (scholarship/permuta/gratuita).
 * Sorted by série order, then student name.
 */
export async function getAlunosSemValor(
  filters: import("./alunos-sem-valor-constants").AlunosSemValorFilters
): Promise<import("./alunos-sem-valor-constants").AlunoSemValorRow[]> {
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

  const rows: import("./alunos-sem-valor-constants").AlunoSemValorRow[] = [];
  for (const item of data ?? []) {
    const alunoNode = (item as Record<string, unknown>).alunos as
      | { id: string; nome: string; responsaveis_aluno?: import("./alunos-sem-valor-constants").RawResponsavel[] }
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
