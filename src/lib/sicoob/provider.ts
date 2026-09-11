import "server-only";
import { criarCobPixImediata, consultarCobPix } from "@/lib/sicoob/pix";
import { gerarTxidOrigem } from "@/lib/sicoob/txid";
import type { PaymentProvider } from "@/lib/pagamentos/provider";

export const sicoobProvider: PaymentProvider = {
  id: "sicoob",
  suporta: ["pix_imediato"],

  async criarCobranca(input) {
    if (input.tipo !== "pix_imediato") {
      return { ok: false, reason: "Sicoob suporta apenas Pix imediato nesta fase" };
    }
    if (!input.conta?.chave_pix) return { ok: false, reason: "Conta sem chave Pix" };

    const txid = gerarTxidOrigem(input.origemTipo ?? "cobranca", input.origemId ?? input.cobranca.id);
    const expiracao = 86400;
    const cob = await criarCobPixImediata({
      txid,
      chave: input.conta.chave_pix,
      valor: Number(input.cobranca.valor_final),
      nomeDevedor: input.responsavel.nome,
      cpfDevedor: input.responsavel.cpf,
      solicitacaoPagador: input.cobranca.descricao,
      expiracao,
    });

    if (!cob.ok) return cob;

    const criadoEm = cob.data.calendario?.criacao
      ? new Date(cob.data.calendario.criacao)
      : new Date();
    const expiraEm = new Date(criadoEm.getTime() + expiracao * 1000).toISOString();

    return {
      ok: true,
      data: {
        provedor: "sicoob",
        tipo: "pix_imediato",
        id_externo: cob.data.txid ?? txid,
        status_externo: cob.data.status,
        pix_copia_cola: cob.data.pixCopiaECola,
        pix_location: cob.data.location,
        expira_em: expiraEm,
        payload: cob.data,
      },
    };
  },

  async consultarCobranca(idExterno) {
    const cob = await consultarCobPix(idExterno);
    if (!cob.ok) return cob;
    return {
      ok: true,
      data: {
        id_externo: cob.data.txid ?? idExterno,
        status: cob.data.status ?? "desconhecido",
        payload: cob.data,
      },
    };
  },
};
