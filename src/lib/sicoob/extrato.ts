import "server-only";
import { getSicoobEndpoints } from "@/lib/sicoob/endpoints";
import { sicoobRequest } from "@/lib/sicoob/http";

export type SicoobExtratoItem = {
  idTransacao?: string;
  id?: string;
  data?: string;
  tipo?: string;
  valor?: string | number;
  descricao?: string;
  endToEndId?: string;
  documentoContraparte?: string;
  [key: string]: unknown;
};

export type SicoobExtratoResponse = {
  resultado?: SicoobExtratoItem[];
  transacoes?: SicoobExtratoItem[];
  [key: string]: unknown;
};

export function consultarExtrato(input: {
  contaCorrente: string;
  dataInicio: string;
  dataFim: string;
}) {
  const endpoints = getSicoobEndpoints();
  const query = new URLSearchParams({
    numeroContaCorrente: input.contaCorrente,
    dataInicio: input.dataInicio,
    dataFim: input.dataFim,
  });
  return sicoobRequest<SicoobExtratoResponse>(`${endpoints.contaCorrenteBasePath}/extrato?${query}`, {
    scope: "cco_extrato",
  });
}
