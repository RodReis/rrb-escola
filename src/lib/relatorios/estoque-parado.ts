// Estoque parado: variações sem saída dentro da janela configurável.
// Sazonalidade (spec 6.4): o usuário define a janela em dias e pode excluir
// meses de baixa temporada — uma saída em mês excluído NÃO conta como "girou".
// Lógica pura; datas no formato YYYY-MM-DD.

export interface VariacaoParadaInput {
  variacao_id: string;
  rotulo: string;
  saldo: number;
  custo: number;
  ultimaSaida: string | null; // YYYY-MM-DD ou null
}

export interface LinhaEstoqueParado extends VariacaoParadaInput {
  diasParado: number | null;  // null = nunca teve saída
  valorImobilizado: number;
}

function mesDe(data: string): number {
  return Number(data.slice(5, 7)); // 1..12
}

function diffDias(de: string, ate: string): number {
  const a = new Date(`${de}T00:00:00Z`).getTime();
  const b = new Date(`${ate}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

// hoje: YYYY-MM-DD (injetado, não usa Date.now para ser testável).
// janelaDias: nº de dias sem saída para considerar "parado".
// mesesBaixaTemporada: meses (1..12) a ignorar ao avaliar a última saída.
export function estoqueParado(
  itens: VariacaoParadaInput[],
  hoje: string,
  janelaDias: number,
  mesesBaixaTemporada: number[] = []
): LinhaEstoqueParado[] {
  const ignorar = new Set(mesesBaixaTemporada);

  return itens
    .filter((it) => it.saldo > 0)
    .map((it) => {
      // saída em mês de baixa temporada não conta como giro
      const saidaValida = it.ultimaSaida && !ignorar.has(mesDe(it.ultimaSaida)) ? it.ultimaSaida : null;
      const diasParado = saidaValida ? diffDias(saidaValida, hoje) : null;
      return {
        ...it,
        diasParado,
        valorImobilizado: it.saldo * it.custo
      };
    })
    .filter((it) => it.diasParado === null || it.diasParado >= janelaDias)
    .sort((a, b) => b.valorImobilizado - a.valorImobilizado);
}
