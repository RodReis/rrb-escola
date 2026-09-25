import { displayStatus } from "./charge-status";

export type StatusFinanceiroMes = "pago_isaac" | "pago_manual" | "aberto" | "vencido" | null;

type CobrancaMinima = { origem: string; status: string; data_vencimento: string };

/** Prioridade de exibição quando há mais de uma cobrança no mês: um status já
 * pago é a informação mais definitiva e vence qualquer outra; entre não-pagas,
 * vencida é mais urgente que aberta. */
const PRIORIDADE: Record<string, number> = {
  pago_isaac: 3,
  pago_manual: 3,
  vencido: 2,
  aberto: 1,
};

function statusUnico(cobranca: CobrancaMinima, hoje: string): StatusFinanceiroMes {
  const status = displayStatus(cobranca.status, cobranca.data_vencimento, hoje);
  if (status === "cancelada") return null;
  if (status === "paga") return cobranca.origem === "isaac" ? "pago_isaac" : "pago_manual";
  if (status === "vencida") return "vencido";
  return "aberto";
}

/**
 * Deriva o status financeiro do mês corrente para exibição em lista — quando
 * há mais de uma cobrança no mês, prioriza a mais definitiva (paga > vencida
 * > aberta) em vez de pegar "a primeira" ou "a mais recente", porque o que
 * importa para a secretaria é o pior/mais urgente estado, não uma ordem
 * arbitrária.
 */
export function derivarStatusFinanceiroMes(
  cobrancas: CobrancaMinima[],
  hoje: string = new Date().toISOString().slice(0, 10)
): StatusFinanceiroMes {
  let melhor: StatusFinanceiroMes = null;
  let melhorPrioridade = -1;

  for (const cobranca of cobrancas) {
    const status = statusUnico(cobranca, hoje);
    if (status === null) continue;
    const prioridade = PRIORIDADE[status] ?? 0;
    if (prioridade > melhorPrioridade) {
      melhor = status;
      melhorPrioridade = prioridade;
    }
  }

  return melhor;
}
