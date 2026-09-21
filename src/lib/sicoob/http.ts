import "server-only";
import { readSicoobConfig } from "@/lib/sicoob/config";
import { getSicoobAccessToken, getSicoobDispatcher } from "@/lib/sicoob/auth";
import { getSicoobEndpoints } from "@/lib/sicoob/endpoints";

export type SicoobHttpResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string; status?: number };

export function extrairErroSicoob(json: unknown, status: number): string {
  const body = json as {
    mensagens?: Array<{ mensagem?: string }>;
    message?: string;
    error?: string;
  } | null;
  return body?.mensagens?.[0]?.mensagem ?? body?.message ?? body?.error ?? `Sicoob HTTP ${status}`;
}

function shouldRetry(status: number) {
  return status === 429 || status >= 500;
}

export async function sicoobRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    scope: string;
    body?: unknown;
  },
): Promise<SicoobHttpResult<T>> {
  const config = readSicoobConfig();
  if (!config) return { ok: false, reason: "Sicoob não configurado" };

  try {
    const token = await getSicoobAccessToken(config, options.scope);
    const endpoints = getSicoobEndpoints(config.env);
    let lastError: SicoobHttpResult<T> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${endpoints.apiBaseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          client_id: config.clientId,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        dispatcher: getSicoobDispatcher(config),
        signal: AbortSignal.timeout(20000),
      } as RequestInit);

      const json = (await response.json().catch(() => null)) as T;

      if (response.ok) {
        return { ok: true, data: json as T };
      }

      lastError = { ok: false, reason: extrairErroSicoob(json, response.status), status: response.status };
      if (!shouldRetry(response.status)) return lastError;
    }

    return lastError ?? { ok: false, reason: "falha Sicoob" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "falha Sicoob" };
  }
}
