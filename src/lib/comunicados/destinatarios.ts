import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type Alvo = { tipo: "turma" | "serie"; id: string };

export type CriterioAlvo = { tipo: "turma" | "serie"; id: string; nome: string };
export type AlvosSegmentado = { alunos: string[]; criterio: CriterioAlvo[] };

export type Destinatario = {
  alunoId: string;
  telefone: string;
};

type ResponsavelRow = {
  celular: string | null;
  responsavel_financeiro: boolean | null;
};

type AlunoRow = {
  id: string;
  responsaveis_aluno: ResponsavelRow[];
};

// Parte pura: filtra alunos que têm responsável financeiro com celular.
export function filtrarDestinatarios(linhas: AlunoRow[]): Destinatario[] {
  const resultado: Destinatario[] = [];
  for (const aluno of linhas) {
    const financeiro = (aluno.responsaveis_aluno ?? []).find(
      (r) => r.responsavel_financeiro === true && !!r.celular,
    );
    if (financeiro?.celular) {
      resultado.push({ alunoId: aluno.id, telefone: financeiro.celular });
    }
  }
  return resultado;
}

type SupabaseLike = {
  from: (table: string) => any;
};

// Parte com I/O: resolve os destinatários conforme o alcance do comunicado.
// Para "segmentado", recebe a lista de alunoIds já resolvida pela UI.
export async function resolverDestinatarios(
  supabase: SupabaseLike,
  alcance: "geral" | "individual" | "segmentado",
  alunoId: string | null,
  alunoIdsSegmentado: string[],
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<Destinatario[]> {
  if (alcance === "individual" && !alunoId) return [];
  if (alcance === "segmentado" && alunoIdsSegmentado.length === 0) return [];

  let query = supabase
    .from("alunos")
    .select("id, responsaveis_aluno(celular, responsavel_financeiro), matriculas!inner(status)")
    .eq("escola_id", escolaId)
    .eq("matriculas.status", "ativa");

  if (alcance === "individual" && alunoId) {
    query = query.eq("id", alunoId);
  }

  if (alcance === "segmentado") {
    query = query.in("id", alunoIdsSegmentado);
  }

  const { data } = await query;

  const vistos = new Set<string>();
  const unicos: AlunoRow[] = [];
  for (const row of (data ?? []) as AlunoRow[]) {
    if (vistos.has(row.id)) continue;
    vistos.add(row.id);
    unicos.push(row);
  }

  return filtrarDestinatarios(unicos);
}
