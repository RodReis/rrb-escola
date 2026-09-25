/** PostgREST usa GET: `.in()` com centenas de uuids estoura o tamanho da URL. */
export function emLotes<T>(itens: T[], tamanho = 150): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}
