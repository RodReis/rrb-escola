// Helpers puros de mapeamento de atividade do pipeline.
// Separado de pipeline-atividade.ts (que importa server-only) para ser testável em node.

import type { TipoAtividade } from "@/lib/validation/pipeline";

export type AtividadeRecente = {
  id: string;
  tipo: TipoAtividade;
  descricao: string;
  createdAt: string;
  autorNome: string | null;
  cardTitulo: string | null;
};

// Linha crua vinda do Supabase (embeds podem ser objeto OU array conforme cardinalidade).
export type RawAtividade = {
  id: string;
  tipo: string;
  descricao: string | null;
  created_at: string;
  usuario?: { nome: string | null } | { nome: string | null }[] | null;
  card?: { titulo: string | null } | { titulo: string | null }[] | null;
};

function primeiro<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Normaliza linhas cruas → AtividadeRecente, ordena desc por created_at e limita.
export function mapAtividades(rows: RawAtividade[], limit = 5): AtividadeRecente[] {
  return rows
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      tipo: row.tipo as TipoAtividade,
      descricao: row.descricao ?? "",
      createdAt: row.created_at,
      autorNome: primeiro(row.usuario)?.nome ?? null,
      cardTitulo: primeiro(row.card)?.titulo ?? null,
    }));
}
