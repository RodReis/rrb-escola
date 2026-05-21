import "server-only";

const EVENTOS_PAGAMENTO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

// Decide se um evento de webhook do Asaas representa pagamento confirmado.
export function eventoConfirmaPagamento(evento: string): boolean {
  return EVENTOS_PAGAMENTO.has(evento);
}
