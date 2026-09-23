import "server-only";
import { getSicoobEndpoints } from "@/lib/sicoob/endpoints";
import { sicoobRequest } from "@/lib/sicoob/http";

export type SicoobSaldo = {
  saldo?: number;
  saldoDisponivel?: number;
  [key: string]: unknown;
};

export function consultarSaldo(contaCorrente: string, credencialRef?: string | null) {
  const endpoints = getSicoobEndpoints();
  const query = new URLSearchParams({ numeroContaCorrente: contaCorrente });
  return sicoobRequest<SicoobSaldo>(`${endpoints.contaCorrenteBasePath}/saldo?${query}`, {
    scope: "cco_consulta",
    credencialRef,
  });
}
