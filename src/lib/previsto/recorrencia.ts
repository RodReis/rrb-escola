export type Recorrente = {
  id: string;
  escolaId: string;
  companyId: string | null;
  descricao: string;
  categoriaId: string;
  contraparte: string | null;
  valorReferencia: number | null;
  diaVencimento: number;
  classeDespesa: "fixa" | "variavel" | null;
  ativo: boolean;
  inicioCompetencia: string;
  fimCompetencia: string | null;
};

export type TituloParaInserir = {
  escola_id: string;
  tipo: "despesa";
  competencia: string;
  descricao: string;
  categoria_id: string;
  company_id: string | null;
  classe_despesa: "fixa" | "variavel" | null;
  contraparte: string | null;
  valor: number;
  data_vencimento: string;
  status: "aberta";
  origem_tipo: "manual";
  recorrente_id: string;
};

/** Dia 31 em mês curto vence no último dia do mês. */
export function dataDeVencimento(competencia: string, dia: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${competencia}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

// Competências são 'AAAA-MM': a comparação lexicográfica é a cronológica.
export function recorrenteVigente(r: Recorrente, competencia: string): boolean {
  if (!r.ativo) return false;
  if (competencia < r.inicioCompetencia) return false;
  if (r.fimCompetencia !== null && competencia > r.fimCompetencia) return false;
  return true;
}

/**
 * O que a competência pede de cada recorrente vigente.
 *
 * `lancamento_financeiro.valor` é `not null > 0`, então recorrente de valor
 * variável (água, luz) não vira título até alguém informar o valor real —
 * inventar um valor é pior que admitir que ainda não se sabe.
 */
export function planejarCompetencia(recorrentes: Recorrente[], competencia: string) {
  const gerar: TituloParaInserir[] = [];
  const aguardandoValor: Recorrente[] = [];

  for (const r of recorrentes) {
    if (!recorrenteVigente(r, competencia)) continue;
    if (r.valorReferencia === null) {
      aguardandoValor.push(r);
      continue;
    }
    gerar.push({
      escola_id: r.escolaId,
      tipo: "despesa",
      competencia,
      descricao: r.descricao,
      categoria_id: r.categoriaId,
      company_id: r.companyId,
      classe_despesa: r.classeDespesa,
      contraparte: r.contraparte,
      valor: r.valorReferencia,
      data_vencimento: dataDeVencimento(competencia, r.diaVencimento),
      status: "aberta",
      origem_tipo: "manual",
      recorrente_id: r.id,
    });
  }
  return { gerar, aguardandoValor };
}
