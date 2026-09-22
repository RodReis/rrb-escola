/**
 * Pure types, constants, and functions for the "alunos sem valor" feature.
 * This file is safe to import in both Server and Client Components.
 * Do NOT add any server-only imports (e.g. next/headers, supabase server) here.
 */

export type TipoVaga =
  | "NORMAL"
  | "BOLSA_50_PORCENTO"
  | "BOLSA_INTEGRAL"
  | "FILHO_PROFESSORA"
  | "FILHO_PROFESSORA_INTEGRAL"
  | "PERMUTA"
  | "ISENTO";

export type MotivoSemValor =
  | "sem_matricula"
  | "sem_valor"
  | "BOLSA_50_PORCENTO"
  | "BOLSA_INTEGRAL"
  | "FILHO_PROFESSORA"
  | "FILHO_PROFESSORA_INTEGRAL"
  | "PERMUTA"
  | "ISENTO";

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
  valor_mensalidade_praticado: number | null;
  percentual_bolsa: number | null;
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
  valorMensalidadePraticado: number | null;
  percentualBolsa: number | null;
  responsaveis: ResponsavelRow[];
};

export type AlunosSemValorFilters = {
  nome: string | null;
  motivo: MotivoSemValor | null;
  serieId: string | null;
  turmaId: string | null;
  anoLetivo?: number;
};

export const MOTIVO_LABEL: Record<MotivoSemValor, string> = {
  sem_matricula: "Sem matrícula",
  sem_valor: "Sem valor",
  BOLSA_50_PORCENTO: "Bolsa 50%",
  BOLSA_INTEGRAL: "Bolsa integral",
  FILHO_PROFESSORA: "Filho de professora",
  FILHO_PROFESSORA_INTEGRAL: "Filho de professora integral",
  PERMUTA: "Permuta",
  ISENTO: "Isento",
};

export function motivoTone(motivo: MotivoSemValor): "danger" | "warning" | "neutral" {
  if (motivo === "sem_matricula" || motivo === "sem_valor") return "danger";
  if (motivo === "BOLSA_50_PORCENTO" || motivo === "BOLSA_INTEGRAL" || motivo === "FILHO_PROFESSORA_INTEGRAL") return "warning";
  return "neutral";
}

/** True when the matrícula has no defined value: no praticado set AND (no plan or plan value 0/null). */
export function isSemValor(
  planoId: string | null,
  valorMatricula: number | null,
  valorMensalidadePraticado: number | null
): boolean {
  if (valorMensalidadePraticado != null && valorMensalidadePraticado > 0) return false;
  if (!planoId) return true;
  return valorMatricula == null || valorMatricula <= 0;
}

/**
 * Returns the Motivo for an aluno, or null if the aluno should NOT appear in the grid.
 * - No 2026 matrícula -> "sem_matricula".
 * - Has matrícula, tipo_vaga non-NORMAL -> the tipo_vaga (precedence over sem_valor).
 * - Has matrícula, NORMAL, no value -> "sem_valor".
 * - Has matrícula, NORMAL, valid value (plan or praticado) -> null (not shown).
 */
export function deriveMotivo(
  tipoVaga: TipoVaga,
  planoId: string | null,
  valorMatricula: number | null,
  valorMensalidadePraticado: number | null,
  hasMatricula: boolean
): MotivoSemValor | null {
  if (!hasMatricula) return "sem_matricula";
  if (tipoVaga !== "NORMAL") return tipoVaga;
  if (isSemValor(planoId, valorMatricula, valorMensalidadePraticado)) return "sem_valor";
  return null;
}

/** Builds an AlunoSemValorRow from a raw aluno (with optional 2026 matrícula), or null if it should not appear. */
export function buildRow(raw: RawAluno): AlunoSemValorRow | null {
  const matricula = raw.matriculas[0] ?? null;
  const hasMatricula = matricula !== null;
  const valor = matricula?.planos?.valor_matricula ?? null;
  const valorPraticado = matricula?.valor_mensalidade_praticado ?? null;
  const motivo = deriveMotivo(
    matricula?.tipo_vaga ?? "NORMAL",
    matricula?.plano_id ?? null,
    valor,
    valorPraticado,
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
    valorMensalidadePraticado: matricula?.valor_mensalidade_praticado ?? null,
    percentualBolsa: matricula?.percentual_bolsa ?? null,
    responsaveis,
  };
}
