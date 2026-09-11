import { asaasProvider } from "@/lib/pagamentos/asaas.provider";
import { sicoobProvider } from "@/lib/sicoob/provider";
import type { PaymentProvider, ProvedorPagamento } from "@/lib/pagamentos/provider";

const providers: Record<ProvedorPagamento, PaymentProvider> = {
  asaas: asaasProvider,
  sicoob: sicoobProvider,
};

export function getPaymentProvider(provedor: ProvedorPagamento): PaymentProvider {
  return providers[provedor];
}
