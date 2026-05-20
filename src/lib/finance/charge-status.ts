export type CobrancaStatusDisplay = "aberta" | "parcial" | "paga" | "vencida" | "cancelada";

export function displayStatus(
  status: string,
  dataVencimento: string,
  today: string = new Date().toISOString().slice(0, 10)
): CobrancaStatusDisplay {
  if (status === "paga" || status === "cancelada") return status;
  if (dataVencimento < today && (status === "aberta" || status === "parcial")) return "vencida";
  return status as CobrancaStatusDisplay;
}

export function isUnpaid(status: CobrancaStatusDisplay): boolean {
  return status === "aberta" || status === "parcial" || status === "vencida";
}
