export type Combinacao = { turmaId: string; etapa: number };

export function unicos<T>(lista: T[]): T[] {
  return lista.filter((x, i) => lista.indexOf(x) === i);
}

/**
 * Lote: todas as combinações turma × etapa, menos as que já existem para o mesmo
 * questionário + professor (`existentes`). `ignoradas` = quantas já existiam.
 */
export function combinarAssociacoes(
  etapas: number[],
  turmaIds: string[],
  existentes: Combinacao[],
): { criar: Combinacao[]; ignoradas: number } {
  const criar: Combinacao[] = [];
  let ignoradas = 0;
  for (const turmaId of unicos(turmaIds)) {
    for (const etapa of unicos(etapas)) {
      if (existentes.some((x) => x.turmaId === turmaId && x.etapa === etapa)) ignoradas++;
      else criar.push({ turmaId, etapa });
    }
  }
  return { criar, ignoradas };
}

/** Ano que a tela abre selecionado: o atual, se há turmas nele; senão o mais recente. */
export function anoPadrao(anos: number[], atual: number): number | null {
  if (anos.length === 0) return null;
  if (anos.indexOf(atual) >= 0) return atual;
  return anos.reduce((a, b) => (b > a ? b : a));
}

export const TURNO_LABEL: Record<string, string> = {
  matutino: "Matutino",
  vespertino: "Vespertino",
  noturno: "Noturno",
  integral: "Integral",
};

export function rotuloTurma(nome: string, turno: string): string {
  const turnoLabel = TURNO_LABEL[turno] ?? turno;
  return nome.trim().toLowerCase() === turnoLabel.toLowerCase() ? nome : `${nome} (${turnoLabel})`;
}
