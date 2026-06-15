// Lógica pura de estoque (espelha o trigger/view do banco). Saldo = Σ quantidade × sentido.
// Fonte de verdade real é o banco; isto serve para teste e cálculo no client.

export type TipoMovimento = "entrada" | "saida" | "ajuste";

export interface Movimento {
  tipo: TipoMovimento;
  quantidade: number; // sempre positivo
  sentido: -1 | 1;    // forçado por tipo (entrada=+1, saida=-1, ajuste=livre)
}

// Sentido efetivo: entrada/saida ignoram o que vier; ajuste mantém.
export function sentidoEfetivo(tipo: TipoMovimento, sentidoInformado: -1 | 1): -1 | 1 {
  if (tipo === "entrada") return 1;
  if (tipo === "saida") return -1;
  return sentidoInformado;
}

export function deltaMovimento(m: Movimento): number {
  return m.quantidade * sentidoEfetivo(m.tipo, m.sentido);
}

export function saldoDe(movimentos: Movimento[]): number {
  return movimentos.reduce((acc, m) => acc + deltaMovimento(m), 0);
}

// Um movimento é permitido se não deixar o saldo negativo.
export function movimentoPermitido(saldoAtual: number, m: Movimento): boolean {
  return saldoAtual + deltaMovimento(m) >= 0;
}

// Reposição: saldo no nível mínimo ou abaixo.
export function precisaReposicao(saldo: number, estoqueMinimo: number): boolean {
  return saldo <= estoqueMinimo;
}
