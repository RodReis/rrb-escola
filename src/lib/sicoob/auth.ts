import "server-only";
import { Agent } from "undici";
import { getSicoobEndpoints } from "@/lib/sicoob/endpoints";
import type { SicoobConfig } from "@/lib/sicoob/config";

type TokenCache = {
  token: string;
  expiresAt: number;
};

/**
 * Cache de token por (clientId, scope).
 *
 * Era um slot único chaveado só por scope. Com dois CNPJs — cada um com seu app
 * e seu certificado — o token do primeiro seria devolvido para o segundo, que
 * então consultaria a conta errada sem erro nenhum. O clientId entra na chave
 * porque é o que distingue as credenciais.
 */
const tokenCache = new Map<string, TokenCache>();

function chaveToken(clientId: string, scope: string): string {
  return `${clientId}|${scope}`;
}

export function resetSicoobTokenCacheForTests() {
  tokenCache.clear();
  dispatcherCache.clear();
}

/**
 * Um `Agent` por certificado, reaproveitado.
 *
 * Antes era criado um Agent novo a cada request, o que abre um pool TLS por
 * chamada — com o sync iterando contas e competências, isso multiplica
 * handshakes. A chave é o próprio certificado, então dois CNPJs mantêm
 * conexões separadas, como precisam.
 */
const dispatcherCache = new Map<string, Agent>();

export function getSicoobDispatcher(config: SicoobConfig) {
  if (config.env === "sandbox") return undefined;
  const chave = config.certPem;
  const existente = dispatcherCache.get(chave);
  if (existente) return existente;
  const agent = new Agent({
    connect: {
      cert: config.certPem,
      key: config.keyPem,
    },
  });
  dispatcherCache.set(chave, agent);
  return agent;
}

export async function getSicoobAccessToken(
  config: SicoobConfig,
  scope: string,
): Promise<string> {
  if (config.env === "sandbox") return config.sandboxToken;

  const now = Date.now();
  const chave = chaveToken(config.clientId, scope);
  const emCache = tokenCache.get(chave);
  if (emCache && emCache.expiresAt > now) {
    return emCache.token;
  }

  const endpoints = getSicoobEndpoints(config.env);
  if (!endpoints.authUrl) throw new Error("Auth URL Sicoob ausente");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    scope,
  });

  const response = await fetch(endpoints.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    dispatcher: getSicoobDispatcher(config),
    signal: AbortSignal.timeout(15000),
  } as RequestInit);

  const json = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  } | null;

  if (!response.ok || !json?.access_token) {
    throw new Error(json?.error_description ?? json?.error ?? `Sicoob auth HTTP ${response.status}`);
  }

  tokenCache.set(chave, {
    token: json.access_token,
    expiresAt: now + Math.max((json.expires_in ?? 300) - 60, 30) * 1000,
  });
  return json.access_token;
}
