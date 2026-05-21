import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type Alvo = { tipo: "turma" | "serie"; id: string };

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

// Parte pura: junta as turmas diretas com as turmas expandidas das séries.
// turmasPorSerie mapeia serieId → lista de turmaIds. Resultado deduplicado.
export function coletarTurmaIds(
  alvos: Alvo[],
  turmasPorSerie: Record<string, string[]>,
): string[] {
  const ids = new Set<string>();
  for (const alvo of alvos) {
    if (alvo.tipo === "turma") {
      ids.add(alvo.id);
    } else {
      for (const turmaId of turmasPorSerie[alvo.id] ?? []) {
        ids.add(turmaId);
      }
    }
  }
  return Array.from(ids);
}

type SupabaseLike = {
  from: (table: string) => any;
};

// Parte com I/O: busca alunos ativos e seus responsáveis financeiros.
export async function resolverDestinatarios(
  supabase: SupabaseLike,
  alcance: "geral" | "individual",
  alunoId: string | null,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<Destinatario[]> {
  // Guard: individual sem aluno definido não deve virar envio geral.
  if (alcance === "individual" && !alunoId) {
    return [];
  }

  let query = supabase
    .from("alunos")
    .select("id, responsaveis_aluno(celular, responsavel_financeiro), matriculas!inner(status)")
    .eq("escola_id", escolaId)
    .eq("matriculas.status", "ativa");

  if (alcance === "individual" && alunoId) {
    query = query.eq("id", alunoId);
  }

  const { data } = await query;

  // Dedup de alunos (o join com matriculas pode repetir a linha do aluno).
  const vistos = new Set<string>();
  const unicos: AlunoRow[] = [];
  for (const row of (data ?? []) as AlunoRow[]) {
    if (vistos.has(row.id)) continue;
    vistos.add(row.id);
    unicos.push(row);
  }

  return filtrarDestinatarios(unicos);
}
