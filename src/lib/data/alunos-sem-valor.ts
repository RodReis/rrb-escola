import "server-only";

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
  return !valorMatricula || valorMatricula <= 0;
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
