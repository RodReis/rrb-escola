import "server-only";
import { getSicoobEndpoints } from "@/lib/sicoob/endpoints";
import { sicoobRequest } from "@/lib/sicoob/http";

export type SicoobExtratoItem = {
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
}) {
  const endpoints = getSicoobEndpoints();
  const query = new URLSearchParams({ numeroContaCorrente: input.contaCorrente });
  return sicoobRequest<SicoobExtratoResponse>(
    `${endpoints.contaCorrenteBasePath}/extrato/${input.mes}/${input.ano}?${query}`,
    { scope: "cco_extrato" },
  );
}
