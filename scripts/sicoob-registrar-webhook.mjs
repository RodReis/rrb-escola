#!/usr/bin/env node

import { Agent, fetch } from "undici";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Env ausente: ${name}`);
  return value;
};

const env = process.env.SICOOB_ENV === "production" ? "production" : "sandbox";
const clientId = required("SICOOB_CLIENT_ID");
const chave = process.argv[2] ?? process.env.SICOOB_CHAVE_PIX;
if (!chave) throw new Error("Informe a chave Pix no primeiro argumento ou em SICOOB_CHAVE_PIX");
const webhookBaseUrl = required("SICOOB_WEBHOOK_URL").replace(/\/$/, "");
const secret = process.env.SICOOB_WEBHOOK_SECRET;
const apiBaseUrl = env === "production"
  ? "https://api.sicoob.com.br"
  : "https://sandbox.sicoob.com.br/sicoob/sandbox";

const dispatcher = env === "production"
  ? new Agent({
      connect: {
        cert: Buffer.from(required("SICOOB_CERT_PEM_B64"), "base64").toString("utf8"),
        key: Buffer.from(required("SICOOB_KEY_PEM_B64"), "base64").toString("utf8"),
      },
    })
  : undefined;

async function getToken() {
  if (env === "sandbox") return required("SICOOB_SANDBOX_TOKEN");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    scope: "webhook.write webhook.read",
  });

  const response = await fetch(
    "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      dispatcher,
    },
  );
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.access_token) {
    throw new Error(json?.error_description ?? json?.error ?? `Sicoob auth HTTP ${response.status}`);
  }
  return json.access_token;
}

const webhookUrl = `${webhookBaseUrl}/api/sicoob/webhook/pix${secret ? `?t=${encodeURIComponent(secret)}` : ""}`;
const token = await getToken();

const response = await fetch(`${apiBaseUrl}/pix/api/v2/webhook/${encodeURIComponent(chave)}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    client_id: clientId,
  },
  body: JSON.stringify({ webhookUrl }),
  dispatcher,
});

const body = await response.text();
if (!response.ok) {
  console.error(body);
  process.exit(1);
}

console.log(body || JSON.stringify({ ok: true, webhookUrl }));
