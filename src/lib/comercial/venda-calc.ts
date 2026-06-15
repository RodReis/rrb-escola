// Cálculo puro de venda (testável). Espelha o que a RPC confirmar_venda faz no banco:
// total = Σ(quantidade × preco_unit) − desconto. Validação de cupom (cartão).

export interface ItemCalc {
  quantidade: number;
  preco_unit: number;
}

export function subtotalItem(item: ItemCalc): number {
  return item.quantidade * item.preco_unit;
}

export function somaItens(itens: ItemCalc[]): number {
  return itens.reduce((acc, i) => acc + subtotalItem(i), 0);
}

export function totalVenda(itens: ItemCalc[], desconto: number): number {
  return somaItens(itens) - desconto;
}

// Cupom da maquininha é obrigatório quando forma de pagamento é cartão (spec 5.5).
export function cupomObrigatorio(formaPagamento: string | null | undefined): boolean {
  return formaPagamento === "cartao";
}

export function vendaValida(
  itens: ItemCalc[],
  desconto: number,
  formaPagamento: string | null | undefined,
  numeroCupom: string | null | undefined
): { ok: true } | { ok: false; erro: string } {
  if (itens.length === 0) return { ok: false, erro: "Venda sem itens" };
  const total = totalVenda(itens, desconto);
  if (total <= 0) return { ok: false, erro: "Total da venda deve ser positivo" };
  if (cupomObrigatorio(formaPagamento) && !numeroCupom?.trim()) {
    return { ok: false, erro: "Número do cupom é obrigatório para cartão" };
  }
  return { ok: true };
}
