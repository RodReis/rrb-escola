export type StatusDespesa = "aberta" | "paga" | "cancelada";
export type DisplayStatusDespesa = StatusDespesa | "vencida";

export interface DespesaStatusInput {
  status: StatusDespesa;
  data_vencimento: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function displayDespesaStatus(d: DespesaStatusInput): DisplayStatusDespesa {
  if (d.status === "aberta" && d.data_vencimento < today()) return "vencida";
  return d.status;
}

export function isVencida(d: DespesaStatusInput): boolean {
  return displayDespesaStatus(d) === "vencida";
}
