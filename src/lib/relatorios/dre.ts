// DRE simplificado: agrupa lançamentos do razão por categoria, separando
// receita e despesa, e calcula resultado. Também agrupa por evento (centro de custo).
// Lógica pura — fonte são linhas já lidas do banco.

export interface LancamentoDRE {
  tipo: "receita" | "despesa";
  categoria_id: string | null;
  categoria_nome: string | null;
  valor: number;
  status: "aberta" | "paga" | "cancelada";
  evento_id?: string | null;
  evento_nome?: string | null;
}

export interface LinhaCategoria {
  categoria_id: string | null;
  categoria_nome: string;
  total: number;
}

export interface ResultadoDRE {
  receitas: LinhaCategoria[];
  despesas: LinhaCategoria[];
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
}

// Considera apenas não-cancelados.
function ativos(linhas: LancamentoDRE[]): LancamentoDRE[] {
  return linhas.filter((l) => l.status !== "cancelada");
}

function agrupaPorCategoria(linhas: LancamentoDRE[]): LinhaCategoria[] {
  const mapa = new Map<string, LinhaCategoria>();
  for (const l of linhas) {
    const key = l.categoria_id ?? "__sem__";
    const nome = l.categoria_nome ?? "Sem categoria";
    const atual = mapa.get(key) ?? { categoria_id: l.categoria_id, categoria_nome: nome, total: 0 };
    atual.total += l.valor;
    mapa.set(key, atual);
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

export function montarDRE(linhas: LancamentoDRE[]): ResultadoDRE {
  const base = ativos(linhas);
  const receitas = agrupaPorCategoria(base.filter((l) => l.tipo === "receita"));
  const despesas = agrupaPorCategoria(base.filter((l) => l.tipo === "despesa"));
  const totalReceitas = receitas.reduce((a, l) => a + l.total, 0);
  const totalDespesas = despesas.reduce((a, l) => a + l.total, 0);
  return {
    receitas,
    despesas,
    totalReceitas,
    totalDespesas,
    resultado: totalReceitas - totalDespesas
  };
}

export interface ResultadoEvento {
  evento_id: string;
  evento_nome: string;
  receitas: number;
  despesas: number;
  resultado: number;
}

// Resultado por evento (centro de custo) — "a feira deu lucro?".
export function resultadoPorEvento(linhas: LancamentoDRE[]): ResultadoEvento[] {
  const base = ativos(linhas).filter((l) => l.evento_id);
  const mapa = new Map<string, ResultadoEvento>();
  for (const l of base) {
    const id = l.evento_id as string;
    const atual = mapa.get(id) ?? {
      evento_id: id,
      evento_nome: l.evento_nome ?? "Evento",
      receitas: 0,
      despesas: 0,
      resultado: 0
    };
    if (l.tipo === "receita") atual.receitas += l.valor;
    else atual.despesas += l.valor;
    atual.resultado = atual.receitas - atual.despesas;
    mapa.set(id, atual);
  }
  return Array.from(mapa.values()).sort((a, b) => b.resultado - a.resultado);
}
