import "server-only";
import type { SicoobEnv } from "@/lib/sicoob/endpoints";
import { getSicoobEnv } from "@/lib/sicoob/endpoints";

export type SicoobConfig =
  | {
      env: "sandbox";
      clientId: string;
      sandboxToken: string;
      certNotAfter?: string;
    }
  | {
      env: "production";
      clientId: string;
      certPem: string;
      keyPem: string;
      certNotAfter?: string;
    };

function fromBase64(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  return Buffer.from(value, "base64").toString("utf8");
}

export function readSicoobConfig(env: SicoobEnv = getSicoobEnv()): SicoobConfig | null {
  const clientId = process.env.SICOOB_CLIENT_ID;
  if (!clientId) return null;

  const base = {
    certNotAfter: process.env.SICOOB_CERT_NOT_AFTER,
  };

  if (env === "sandbox") {
    const sandboxToken = process.env.SICOOB_SANDBOX_TOKEN;
    if (!sandboxToken) return null;
    return { env, clientId, sandboxToken, ...base };
  }

  const certPem = fromBase64("SICOOB_CERT_PEM_B64");
  const keyPem = fromBase64("SICOOB_KEY_PEM_B64");
  if (!certPem || !keyPem) return null;
  return { env, clientId, certPem, keyPem, ...base };
}
