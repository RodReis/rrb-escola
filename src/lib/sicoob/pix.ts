import "server-only";
import { getSicoobEndpoints } from "@/lib/sicoob/endpoints";
import { sicoobRequest } from "@/lib/sicoob/http";

export type CriarCobPixInput = {
  txid: string;
  chave: string;
  valor: number;
  nomeDevedor: string;
  cpfDevedor?: string | null;
  solicitacaoPagador: string;
  expiracao?: number;
};

// O Sicoob devolve o copia-e-cola em `brcode`; `pixCopiaECola` é o nome do
// padrão Bacen e vem como fallback caso a API passe a segui-lo.
export type SicoobCobPix = {
  txid?: string;
  status?: string;
  brcode?: string;
  pixCopiaECola?: string;
  location?: string;
  loc?: { brcode?: string; location?: string };
  calendario?: { expiracao?: number; criacao?: string };
};

export function extrairCopiaECola(cob: SicoobCobPix): string | undefined {
  return cob.brcode ?? cob.pixCopiaECola ?? cob.loc?.brcode;
}

// O sandbox do Sicoob responde com dados fictícios (lorem ipsum) em vez do
// BR Code real. Um copia-e-cola válido começa com o payload format indicator
// "0002" do padrão EMV e cita o domínio do arranjo Pix do Bacen. O nome do
// recebedor e a cidade são campos livres, então espaços são permitidos.
export function isCopiaEColaValido(valor: string | undefined): valor is string {
  if (!valor) return false;
  return valor.startsWith("0002") && valor.toLowerCase().includes("br.gov.bcb.pix");
}

export type SicoobPixRecebido = {
  endToEndId?: string;
  txid?: string;
  valor?: string | number;
  horario?: string;
  [key: string]: unknown;
};

export function criarCobPixImediata(input: CriarCobPixInput) {
  const endpoints = getSicoobEndpoints();
  return sicoobRequest<SicoobCobPix>(`${endpoints.pixBasePath}/cob/${input.txid}`, {
    method: "PUT",
    scope: "cob.write cob.read pix.read",
    body: {
      calendario: { expiracao: input.expiracao ?? 86400 },
      devedor: input.cpfDevedor ? {
        cpf: input.cpfDevedor.replace(/\D/g, ""),
        nome: input.nomeDevedor,
      } : undefined,
      valor: { original: input.valor.toFixed(2) },
      chave: input.chave,
      solicitacaoPagador: input.solicitacaoPagador.slice(0, 140),
    },
  });
}

export function consultarCobPix(txid: string) {
  const endpoints = getSicoobEndpoints();
  return sicoobRequest<SicoobCobPix>(`${endpoints.pixBasePath}/cob/${txid}`, {
    scope: "cob.read",
  });
}

export function consultarPixRecebido(endToEndId: string) {
  const endpoints = getSicoobEndpoints();
  return sicoobRequest<SicoobPixRecebido>(`${endpoints.pixBasePath}/pix/${endToEndId}`, {
    scope: "pix.read",
  });
}

export function registrarWebhookPix(chave: string, webhookUrl: string) {
  const endpoints = getSicoobEndpoints();
  return sicoobRequest<{ webhookUrl?: string }>(
    `${endpoints.pixBasePath}/webhook/${encodeURIComponent(chave)}`,
    {
      method: "PUT",
      scope: "webhook.write webhook.read",
      body: { webhookUrl },
    },
  );
}
