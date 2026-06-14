import { displayDespesaStatus, type DespesaStatusInput } from "@/lib/despesas/status";

// Regime de caixa: realização pelo data_pagamento (quando o dinheiro entrou/saiu).
// Regime de competência: pelo campo competencia. NUNCA misturar na mesma coluna (spec 6.5).

export interface LancamentoTotalInput extends DespesaStatusInput {
  tipo: "receita" | "despesa";
  valor: number;
  data_pagamento: string | null;
}

function somaSe(rows: LancamentoTotalInput[], pred: (r: LancamentoTotalInput) => boolean): number {
  return rows.filter(pred).reduce((acc, r) => acc + Number(r.valor), 0);
}

// --- Totais por regime de caixa (pago = status='paga') ---

export function totalReceitasPagas(rows: LancamentoTotalInput[]): number {
  return somaSe(rows, (r) => r.tipo === "receita" && r.status === "paga");
}

export function totalDespesasPagas(rows: LancamentoTotalInput[]): number {
  return somaSe(rows, (r) => r.tipo === "despesa" && r.status === "paga");
}

// Saldo de caixa = receitas pagas − despesas pagas.
export function saldoCaixa(rows: LancamentoTotalInput[]): number {
  return totalReceitasPagas(rows) - totalDespesasPagas(rows);
}

// --- Totais de acompanhamento (todos os não-cancelados, regime competência) ---

export function totalReceitas(rows: LancamentoTotalInput[]): number {
  return somaSe(rows, (r) => r.tipo === "receita" && r.status !== "cancelada");
}

export function totalDespesas(rows: LancamentoTotalInput[]): number {
  return somaSe(rows, (r) => r.tipo === "despesa" && r.status !== "cancelada");
}

export function totalAberto(rows: LancamentoTotalInput[]): number {
  return somaSe(rows, (r) => displayDespesaStatus(r) === "aberta");
}

export function totalVencido(rows: LancamentoTotalInput[]): number {
  return somaSe(rows, (r) => displayDespesaStatus(r) === "vencida");
}
