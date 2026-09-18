import type { HistoricoNota } from "./tipos";

/** Média anual de uma disciplina: média simples das bimestrais lançadas. */
export function mediaAnual(bimestrais: Array<number | null>): number | null {
  const valores = bimestrais.filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  const soma = valores.reduce((acc, v) => acc + v, 0);
  return Math.round((soma / valores.length) * 10) / 10;
}

type NotaConsolidadaRow = {
  disciplina_id: string;
  media: number | null;
  disciplinas: { nome?: string; ordem?: number } | null;
};

/**
 * Agrupa linhas de `notas_consolidadas` por disciplina e calcula a média anual de cada uma.
 * Usada tanto na leitura ao vivo (notasAoVivo) quanto no congelamento (congelarNotasDoAno) —
 * os dois precisam produzir o mesmo resultado a partir dos mesmos dados.
 */
export function agregarNotasConsolidadas(rows: NotaConsolidadaRow[]): HistoricoNota[] {
  const porDisciplina = new Map<string, { nome: string; ordem: number; bimestrais: Array<number | null> }>();
  for (const row of rows) {
    const id = row.disciplina_id;
    let entrada = porDisciplina.get(id);
    if (!entrada) {
      entrada = { nome: row.disciplinas?.nome ?? "", ordem: row.disciplinas?.ordem ?? 0, bimestrais: [] };
      porDisciplina.set(id, entrada);
    }
    entrada.bimestrais.push(row.media === null ? null : Number(row.media));
  }

  return Array.from(porDisciplina.entries())
    .map(([disciplinaId, e]) => ({
      disciplinaId,
      disciplinaNome: e.nome,
      nota: mediaAnual(e.bimestrais),
      cargaHoraria: null,
      faltas: null,
      ordem: e.ordem
    }))
    .sort((a, b) => a.ordem - b.ordem);
}
