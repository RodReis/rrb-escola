import { displayDespesaStatus, type DespesaStatusInput } from "./status";

export interface DespesaTotalInput extends DespesaStatusInput {
  valor: number;
}

export function totalDespesas(rows: DespesaTotalInput[]): number {
  return rows
    .filter((r) => r.status !== "cancelada")
    .reduce((acc, r) => acc + Number(r.valor), 0);
}

export function totalPago(rows: DespesaTotalInput[]): number {
  return rows
    .filter((r) => r.status === "paga")
    .reduce((acc, r) => acc + Number(r.valor), 0);
}

export function totalAberto(rows: DespesaTotalInput[]): number {
  return rows
    .filter((r) => displayDespesaStatus(r) === "aberta")
    .reduce((acc, r) => acc + Number(r.valor), 0);
}

export function totalVencido(rows: DespesaTotalInput[]): number {
  return rows
    .filter((r) => displayDespesaStatus(r) === "vencida")
    .reduce((acc, r) => acc + Number(r.valor), 0);
}
