import "server-only";
import { Agent } from "undici";
import { getSicoobEndpoints } from "@/lib/sicoob/endpoints";
import type { SicoobConfig } from "@/lib/sicoob/config";

type TokenCache = {
  token: string;
  expiresAt: number;
  scope: string;
};

let tokenCache: TokenCache | null = null;

export function resetSicoobTokenCacheForTests() {
  tokenCache = null;
}

export function getSicoobDispatcher(config: SicoobConfig) {
  if (config.env === "sandbox") return undefined;
  return new Agent({
    connect: {
      cert: config.certPem,
      key: config.keyPem,
    },
  });
}

export async function getSicoobAccessToken(
  config: SicoobConfig,
  scope: string,
): Promise<string> {
  if (config.env === "sandbox") return config.sandboxToken;

  const now = Date.now();
  if (tokenCache && tokenCache.scope === scope && tokenCache.expiresAt > now) {
    return tokenCache.token;
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

  tokenCache = {
    token: json.access_token,
    expiresAt: now + Math.max((json.expires_in ?? 300) - 60, 30) * 1000,
    scope,
  };
  return json.access_token;
}
