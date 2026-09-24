import "server-only";
import { getSicoobEndpoints } from "@/lib/sicoob/endpoints";
import { sicoobRequest } from "@/lib/sicoob/http";

export type SicoobExtratoItem = {
  /**
   * Identificador único da transação no Sicoob. Medido em produção em
   * 24/09/2026: 87/87 e 50/50 valores distintos nas duas contas, contra
   * 23 e 12 de `numeroDocumento` — é a única chave confiável do extrato.
   */
  transactionId?: string;
  data?: string;
  dataLote?: string;
  descricao?: string;
  numeroDocumento?: string;
  descInfComplementar?: string;
  cpfCnpj?: string;
  valor?: string | number;
  tipo?: string;
  [key: string]: unknown;
};

export type SicoobExtratoResponse = {
  saldoAtual?: string | number;
  saldoAnterior?: string | number;
  transacoes?: SicoobExtratoItem[];
  [key: string]: unknown;
};

// O extrato do Sicoob é mensal: mês e ano vão no caminho da URL, não como
// intervalo de datas em query string.
export function consultarExtrato(input: {
  contaCorrente: string;
  mes: number;
  ano: number;
  /** Credencial da conta. Ausente usa as variáveis globais. */
  credencialRef?: string | null;
}) {
  const endpoints = getSicoobEndpoints();
  const query = new URLSearchParams({ numeroContaCorrente: input.contaCorrente });
  return sicoobRequest<SicoobExtratoResponse>(
    `${endpoints.contaCorrenteBasePath}/extrato/${input.mes}/${input.ano}?${query}`,
    { scope: "cco_consulta", credencialRef: input.credencialRef },
  );
}
