export type PagamentoLite = {
  valor_pago: number | string;
  cancelado_em: string | null;
};

export function totalPago(pagamentos: PagamentoLite[]): number {
  return pagamentos
    .filter((p) => !p.cancelado_em)
    .reduce((sum, p) => sum + Number(p.valor_pago), 0);
}

export function saldoDevedor(valorFinal: number, pagamentos: PagamentoLite[]): number {
  return Math.max(valorFinal - totalPago(pagamentos), 0);
}
