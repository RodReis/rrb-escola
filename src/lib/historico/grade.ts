import type { HistoricoAno } from "./tipos";

export type CelulaGrade = {
  nota: number | null;
  cargaHoraria: number | null;
};

export type LinhaGrade = {
  disciplina: string;
  celulas: CelulaGrade[];
  chTotal: number | null;
};

const CELULA_VAZIA: CelulaGrade = { nota: null, cargaHoraria: null };

/**
 * Chave de unificação: maiúsculas, sem acento, espaços colapsados.
 * "Matemática" e "MATEMATICA" viram a mesma linha da grade.
 */
export function normalizarDisciplina(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Monta as linhas da grade: uma por disciplina, uma célula por coluna pedida.
 * A grafia impressa é a do primeiro ano em que a disciplina aparece.
 */
export function montarGrade(anos: HistoricoAno[], colunas: string[]): LinhaGrade[] {
  const indicePorColuna = new Map<string, number>();
  colunas.forEach((coluna, i) => indicePorColuna.set(normalizarDisciplina(coluna), i));

  const linhas = new Map<string, LinhaGrade>();

  for (const ano of anos) {
    const coluna = indicePorColuna.get(normalizarDisciplina(ano.serieNome));
    if (coluna === undefined) continue;

    for (const nota of ano.notas) {
      const chave = normalizarDisciplina(nota.disciplinaNome);
      let linha = linhas.get(chave);
      if (!linha) {
        linha = {
          disciplina: nota.disciplinaNome,
          celulas: colunas.map(() => ({ ...CELULA_VAZIA })),
          chTotal: null
        };
        linhas.set(chave, linha);
      }
      linha.celulas[coluna] = { nota: nota.nota, cargaHoraria: nota.cargaHoraria };
      if (nota.cargaHoraria !== null) {
        linha.chTotal = (linha.chTotal ?? 0) + nota.cargaHoraria;
      }
    }
  }

  return Array.from(linhas.values());
}
