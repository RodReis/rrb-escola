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

/**
 * Nome da variável de ambiente de uma credencial.
 *
 * Com `ref`, lê `SICOOB_<REF>_<SUFIXO>`; sem `ref`, `SICOOB_<SUFIXO>`. Cada
 * CNPJ tem app e certificado A1 próprios no portal do Sicoob, então as
 * credenciais não podem ser globais quando há mais de uma conta.
 */
function nomeVar(sufixo: string, ref?: string | null): string {
  return ref ? `SICOOB_${ref}_${sufixo}` : `SICOOB_${sufixo}`;
}

/**
 * Lê a configuração de uma credencial Sicoob.
 *
 * `credencialRef` vem de `contas_bancarias.credencial_ref`. Nulo/ausente usa as
 * variáveis globais, que é o que já está em produção — trocar para multi-CNPJ
 * é cadastrar o ref na conta, sem migração de ambiente.
 *
 * Retorna null quando a credencial não está configurada; quem chama decide se
 * isso é erro fatal (health-check) ou conta a pular (sync de extrato).
 */
export function readSicoobConfig(
  env: SicoobEnv = getSicoobEnv(),
  credencialRef?: string | null,
): SicoobConfig | null {
  const clientId = process.env[nomeVar("CLIENT_ID", credencialRef)];
  if (!clientId) return null;

  const base = {
    certNotAfter: process.env[nomeVar("CERT_NOT_AFTER", credencialRef)],
  };

  if (env === "sandbox") {
    // O sandbox do Sicoob é um token fixo, sem app por CNPJ: a credencial por
    // conta não se aplica e cai no token global.
    const sandboxToken = process.env.SICOOB_SANDBOX_TOKEN;
    if (!sandboxToken) return null;
    return { env, clientId, sandboxToken, ...base };
  }

  const certPem = fromBase64(nomeVar("CERT_PEM_B64", credencialRef));
  const keyPem = fromBase64(nomeVar("KEY_PEM_B64", credencialRef));
  if (!certPem || !keyPem) return null;
  return { env, clientId, certPem, keyPem, ...base };
}
