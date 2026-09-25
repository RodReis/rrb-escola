export type LinhaLancamento = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: "aberta" | "paga";
  origemTipo: string;
  dataVencimento: string;
};

export type LinhaResumo = {
  categoria: string;
  previsto: number;
  realizado: number;
  diferenca: number;
  abertos: number;
  vencidos: number;
};

export type ResumoPrevistoRealizado = {
  linhas: LinhaResumo[];
  totais: { previsto: number; realizado: number; diferenca: number };
  vencidos: LinhaLancamento[];
  realizadoSemPrevisto: { quantidade: number; total: number };
};

const emCentavos = (v: number) => Math.round(v * 100);
const deCentavos = (c: number) => c / 100;

/**
 * Previsto = título aberto ou pago que NÃO nasceu de um débito do extrato.
 * Realizado = qualquer título pago. Diferença = realizado − previsto.
 * "Realizado sem previsto" (pago, origem extrato) é informação, não erro: é o
 * caso normal enquanto alguém pagar pelo app do banco.
 */
export function resumirPrevistoRealizado(linhas: LinhaLancamento[], hoje: string): ResumoPrevistoRealizado {
  const porCategoria = new Map<string, { previsto: number; realizado: number; abertos: number; vencidos: number }>();
  const vencidos: LinhaLancamento[] = [];
  let semPrevistoQtd = 0;
  let semPrevistoTotal = 0;

  for (const x of linhas) {
    const c = emCentavos(x.valor);
    const acc = porCategoria.get(x.categoria) ?? { previsto: 0, realizado: 0, abertos: 0, vencidos: 0 };
    const nasceuDoExtrato = x.origemTipo === "extrato";

    if (!nasceuDoExtrato) acc.previsto += c;
    if (x.status === "paga") {
      acc.realizado += c;
      if (nasceuDoExtrato) {
        semPrevistoQtd += 1;
        semPrevistoTotal += c;
      }
    } else {
      acc.abertos += 1;
      if (x.dataVencimento < hoje) {
        acc.vencidos += 1;
        vencidos.push(x);
      }
    }
    porCategoria.set(x.categoria, acc);
  }

  const resumo: LinhaResumo[] = Array.from(porCategoria.entries())
    .map(([categoria, a]) => ({
      categoria,
      previsto: deCentavos(a.previsto),
      realizado: deCentavos(a.realizado),
      diferenca: deCentavos(a.realizado - a.previsto),
      abertos: a.abertos,
      vencidos: a.vencidos,
    }))
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca) || a.categoria.localeCompare(b.categoria));

  const previsto = Array.from(porCategoria.values()).reduce((s, a) => s + a.previsto, 0);
  const realizado = Array.from(porCategoria.values()).reduce((s, a) => s + a.realizado, 0);

  return {
    linhas: resumo,
    totais: { previsto: deCentavos(previsto), realizado: deCentavos(realizado), diferenca: deCentavos(realizado - previsto) },
    vencidos,
    realizadoSemPrevisto: { quantidade: semPrevistoQtd, total: deCentavos(semPrevistoTotal) },
  };
}
