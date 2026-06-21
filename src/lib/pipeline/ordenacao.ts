/**
 * Calcula nova ordem fracionária para inserção de card em lista.
 * Entrada: lista atual ordenada por `ordem` + índice de destino.
 * Saída: valor `double precision` para o campo `pipeline_card.ordem`.
 *
 * Invariante: sem I/O, sem dependências externas. Testável isolado.
 */
export function calcularOrdem(
  ordensVizinhos: number[],
  indiceDestino: number,
): number {
  const antes = ordensVizinhos[indiceDestino - 1];
  const depois = ordensVizinhos[indiceDestino];

  if (antes === undefined && depois === undefined) return 1;
  if (antes === undefined) return depois - 1;
  if (depois === undefined) return antes + 1;
  return (antes + depois) / 2;
}

/**
 * Extrai as ordens dos cards de uma coluna, excluindo o card movido.
 * Retorna array já ordenado, sem o cardId fornecido.
 */
export function ordensDeColuna(
  cards: { id: string; ordem: number }[],
  excluirCardId?: string,
): number[] {
  return cards
    .filter((c) => c.id !== excluirCardId)
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => c.ordem);
}
