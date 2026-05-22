/**
 * Pure types, constants, and functions for the "alunos sem valor" feature.
 * This file is safe to import in both Server and Client Components.
 * Do NOT add any server-only imports (e.g. next/headers, supabase server) here.
 */

export type TipoVaga = "paga" | "bolsa_integral" | "bolsa_parcial" | "permuta" | "gratuita";

export type MotivoSemValor =
  | "sem_matricula"
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

export type StatusMatricula = "ativa" | "cancelada" | "transferida" | "concluida";

export type RawMatriculaEmbed = {
  id: string;
  tipo_vaga: TipoVaga;
  plano_id: string | null;
  status: StatusMatricula;
  planos: { valor_matricula: number | null } | null;
  turmas: {
    id: string;
    nome: string;
    series: { id: string; nome: string; ordem: number } | null;
  } | null;
};

export type RawAluno = {
  id: string;
  nome: string;
  matriculas: RawMatriculaEmbed[];
  responsaveis_aluno: RawResponsavel[];
};

export type ResponsavelRow = {
  nome: string;
  parentesco: string | null;
  telefone: string;
};

export type AlunoSemValorRow = {
  alunoId: string;
  matriculaId: string | null;
  status: StatusMatricula | null;
  tipoVaga: TipoVaga | null;
  planoId: string | null;
  nome: string;
  serie: string;
  serieId: string | null;
  serieOrdem: number;
  turma: string;
  turmaId: string | null;
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
  sem_matricula: "Sem matrícula",
  sem_valor: "Sem valor",
  bolsa_integral: "Bolsa integral",
  bolsa_parcial: "Bolsa parcial",
  permuta: "Permuta",
  gratuita: "Gratuita",
};

export function motivoTone(motivo: MotivoSemValor): "danger" | "warning" | "neutral" {
  if (motivo === "sem_matricula" || motivo === "sem_valor") return "danger";
  if (motivo === "bolsa_integral" || motivo === "bolsa_parcial") return "warning";
  return "neutral";
}

/** True when the matrícula has no defined value: no plan, or plan value is 0/null. */
export function isSemValor(planoId: string | null, valorMatricula: number | null): boolean {
  if (!planoId) return true;
  return valorMatricula == null || valorMatricula <= 0;
}

/**
 * Returns the Motivo for an aluno, or null if the aluno should NOT appear in the grid.
 * - No 2026 matrícula -> "sem_matricula".
 * - Has matrícula, tipo_vaga non-paga -> the tipo_vaga (precedence over sem_valor).
 * - Has matrícula, paga, no value -> "sem_valor".
 * - Has matrícula, paga, valid value -> null (not shown).
 */
export function deriveMotivo(
  tipoVaga: TipoVaga,
  planoId: string | null,
  valorMatricula: number | null,
  hasMatricula: boolean
): MotivoSemValor | null {
  if (!hasMatricula) return "sem_matricula";
  if (tipoVaga !== "paga") return tipoVaga;
  if (isSemValor(planoId, valorMatricula)) return "sem_valor";
  return null;
}

/** Builds an AlunoSemValorRow from a raw aluno (with optional 2026 matrícula), or null if it should not appear. */
export function buildRow(raw: RawAluno): AlunoSemValorRow | null {
  const matricula = raw.matriculas[0] ?? null;
  const hasMatricula = matricula !== null;
  const valor = matricula?.planos?.valor_matricula ?? null;
  const motivo = deriveMotivo(
    matricula?.tipo_vaga ?? "paga",
    matricula?.plano_id ?? null,
    valor,
    hasMatricula
  );
  if (!motivo) return null;

  const responsaveis: ResponsavelRow[] = [...raw.responsaveis_aluno]
    .sort((a, b) => Number(b.responsavel_financeiro) - Number(a.responsavel_financeiro))
    .map((r) => ({
      nome: r.nome,
      parentesco: r.parentesco,
      telefone: r.celular || r.telefone || "",
    }));

  return {
    alunoId: raw.id,
    matriculaId: matricula?.id ?? null,
    status: matricula?.status ?? null,
    tipoVaga: matricula?.tipo_vaga ?? null,
    planoId: matricula?.plano_id ?? null,
    nome: raw.nome,
    serie: matricula?.turmas?.series?.nome ?? "",
    serieId: matricula?.turmas?.series?.id ?? null,
    serieOrdem: matricula?.turmas?.series?.ordem ?? 9999,
    turma: matricula?.turmas?.nome ?? "",
    turmaId: matricula?.turmas?.id ?? null,
    motivo,
    valorMatricula: valor ?? 0,
    responsaveis,
  };
}
