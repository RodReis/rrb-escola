import "server-only";

export type EvolutionResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: string };

type EvolutionConfig = {
  url: string;
  apiKey: string;
  instance: string;
};

function getConfig(): EvolutionConfig | null {
  const url = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!url || !apiKey || !instance) return null;
  return { url, apiKey, instance };
}

export async function sendWhatsApp({
  telefone,
  mensagem,
}: {
  telefone: string;
  mensagem: string;
}): Promise<EvolutionResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "Evolution API não configurada" };
  }

  const endpoint = `${config.url.replace(/\/$/, "")}/message/sendText/${config.instance}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      body: JSON.stringify({ number: telefone, text: mensagem }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return { ok: false, reason: `Evolution API HTTP ${res.status}: ${texto.slice(0, 200)}` };
    }

    const json = (await res.json().catch(() => null)) as { key?: { id?: string } } | null;
    const providerMessageId = json?.key?.id ?? "";
    return { ok: true, providerMessageId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "falha ao enviar";
    return { ok: false, reason };
  }
}
