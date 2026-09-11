import "server-only";
import { criarCobranca, criarCustomer } from "@/lib/asaas/client";
import type { PaymentProvider } from "@/lib/pagamentos/provider";

export const asaasProvider: PaymentProvider = {
  id: "asaas",
  suporta: ["boleto", "fatura"],

  async criarCobranca(input) {
    if (!input.responsavel.cpf) {
      return { ok: false, reason: "Responsável financeiro precisa de CPF" };
    }

    let customerId = input.responsavel.asaas_customer_id;
    if (!customerId) {
      const customer = await criarCustomer({
        nome: input.responsavel.nome,
        cpfCnpj: input.responsavel.cpf,
        email: input.responsavel.email,
        celular: input.responsavel.celular,
      });
      if (!customer.ok) return customer;
      customerId = customer.data.id;
    }

    if (!customerId) return { ok: false, reason: "Erro ao criar customer Asaas" };

    const cobranca = await criarCobranca({
      customerId,
      valor: Number(input.cobranca.valor_final),
      vencimento: input.cobranca.data_vencimento ?? new Date().toISOString().slice(0, 10),
      descricao: input.cobranca.descricao,
    });

    if (!cobranca.ok) return cobranca;

    return {
      ok: true,
      data: {
        provedor: "asaas",
        tipo: "fatura",
        id_externo: cobranca.data.id,
        status_externo: cobranca.data.status,
        url_fatura: cobranca.data.invoiceUrl,
        payload: cobranca.data,
      },
    };
  },

  async consultarCobranca(idExterno) {
    return {
      ok: false,
      reason: `Consulta Asaas ainda usa fluxo legado para ${idExterno}`,
    };
  },
};
