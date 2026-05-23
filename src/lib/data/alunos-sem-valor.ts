import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import {
  buildRow,
  deriveMotivo,
  isSemValor,
  type RawAluno,
  type RawResponsavel,
  type AlunoSemValorRow,
  type AlunosSemValorFilters,
} from "./alunos-sem-valor-constants";

// Re-export everything so existing imports from this file continue to work.
export type {
  TipoVaga,
  MotivoSemValor,
  StatusMatricula,
  RawResponsavel,
  RawMatriculaEmbed,
  RawAluno,
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
 * Fetches active students and their 2026 active matrícula (if any), keeping only
 * those who have no normal matrícula value: no 2026 matrícula at all, an
 * incomplete registration (no plan / value 0), or a non-paying vaga.
 * Sorted by série order, then student name.
 */
export async function getAlunosSemValor(
  filters: AlunosSemValorFilters
): Promise<AlunoSemValorRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("alunos")
    .select(`
      id, nome,
      matriculas!left(id, tipo_vaga, plano_id, status, ano_letivo, valor_mensalidade_praticado, percentual_bolsa,
        planos(valor_matricula),
        turmas(id, nome, series(id, nome, ordem))),
      responsaveis_aluno(nome, parentesco, telefone, celular, responsavel_financeiro)
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true);

  if (filters.nome) {
    query = query.ilike("nome", `%${filters.nome}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows: AlunoSemValorRow[] = [];
  for (const item of data ?? []) {
    const rec = item as Record<string, unknown>;
    // matriculas comes back as an array; keep only the active 2026 one.
    const allMatriculas = (rec.matriculas as unknown as Array<{
      id: string;
      tipo_vaga: string;
      plano_id: string | null;
      status: string;
      ano_letivo: number;
      valor_mensalidade_praticado: number | null;
      percentual_bolsa: number | null;
      planos: { valor_matricula: number | null } | null;
      turmas: {
        id: string;
        nome: string;
        series: { id: string; nome: string; ordem: number } | null;
      } | null;
    }>) ?? [];
    const matricula2026 = allMatriculas.filter(
      (m) => m.ano_letivo === 2026 && m.status === "ativa"
    );

    const raw: RawAluno = {
      id: rec.id as string,
      nome: rec.nome as string,
      matriculas: matricula2026.map((m) => ({
        id: m.id,
        tipo_vaga: m.tipo_vaga as RawAluno["matriculas"][number]["tipo_vaga"],
        plano_id: m.plano_id,
        status: m.status as RawAluno["matriculas"][number]["status"],
        valor_mensalidade_praticado: m.valor_mensalidade_praticado,
        percentual_bolsa: m.percentual_bolsa,
        planos: m.planos,
        turmas: m.turmas,
      })),
      responsaveis_aluno: (rec.responsaveis_aluno as RawResponsavel[]) ?? [],
    };

    const row = buildRow(raw);
    if (!row) continue;
    if (filters.motivo && row.motivo !== filters.motivo) continue;
    if (filters.serieId && row.serieId !== filters.serieId) continue;
    if (filters.turmaId && row.turmaId !== filters.turmaId) continue;
    rows.push(row);
  }

  rows.sort(
    (a, b) => a.serieOrdem - b.serieOrdem || a.nome.localeCompare(b.nome, "pt-BR")
  );
  return rows;
}
