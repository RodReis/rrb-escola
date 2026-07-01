import "server-only";

type TextParameter = { type: "text"; text: string };
type ImageParameter = { type: "image"; image: { link: string } };

type TemplateComponent =
  | { type: "header"; parameters: ImageParameter[] }
  | { type: "body"; parameters: TextParameter[] };

// Monta o array `components` do payload de template da Meta Cloud API.
// Se imagemUrl for fornecida, adiciona um header de imagem antes do body.
export function montarComponentsTemplate(
  variaveis: string[],
  imagemUrl: string | undefined,
): TemplateComponent[] {
  const components: TemplateComponent[] = [];

  if (imagemUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: imagemUrl } }],
    });
  }

  components.push({
    type: "body",
    parameters: variaveis.map((v) => ({ type: "text", text: v })),
  });

  return components;
}

export function montarPayloadImagem(
  telefone: string,
  imagemUrl: string,
  legenda?: string,
): Record<string, unknown> {
  const image: { link: string; caption?: string } = { link: imagemUrl };
  if (legenda) image.caption = legenda;
  return { to: telefone, type: "image", image };
}

const GRAPH_VERSION = "v21.0";

export type MetaResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: string };

type MetaConfig = {
  token: string;
  phoneNumberId: string;
};

function getConfig(): MetaConfig | null {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

async function postMessage(
  config: MetaConfig,
  body: Record<string, unknown>,
): Promise<MetaResult> {
  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return { ok: false, reason: `Meta API HTTP ${res.status}: ${texto.slice(0, 200)}` };
    }

    const json = (await res.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }> }
      | null;
    const providerMessageId = json?.messages?.[0]?.id ?? "";
    return { ok: true, providerMessageId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "falha ao enviar";
    return { ok: false, reason };
  }
}

// Envia uma mensagem de template aprovado — inicia conversa.
export async function sendTemplate({
  telefone,
  templateName,
  idioma,
  variaveis,
  imagemUrl,
}: {
  telefone: string;
  templateName: string;
  idioma: string;
  variaveis: string[];
  imagemUrl?: string;
}): Promise<MetaResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "Meta WhatsApp não configurada" };
  }

  return postMessage(config, {
    to: telefone,
    type: "template",
    template: {
      name: templateName,
      language: { code: idioma },
      components: montarComponentsTemplate(variaveis, imagemUrl),
    },
  });
}

// Envia texto livre — só funciona dentro da janela de 24h. Não inicia conversa.
export async function sendText({
  telefone,
  mensagem,
}: {
  telefone: string;
  mensagem: string;
}): Promise<MetaResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "Meta WhatsApp não configurada" };
  }

  return postMessage(config, {
    to: telefone,
    type: "text",
    text: { body: mensagem },
  });
}

// Envia uma imagem por link — só funciona dentro da janela de 24h.
export async function sendImage({
  telefone,
  imagemUrl,
  legenda,
}: {
  telefone: string;
  imagemUrl: string;
  legenda?: string;
}): Promise<MetaResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "Meta WhatsApp não configurada" };
  }
  return postMessage(config, montarPayloadImagem(telefone, imagemUrl, legenda));
}

// Resolve a URL temporária de download de uma mídia recebida (media_id do webhook).
export async function getMediaUrl(
  mediaId: string,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const config = getConfig();
  if (!config) return { ok: false, reason: "Meta WhatsApp não configurada" };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, reason: `Meta media HTTP ${res.status}` };
    const json = (await res.json().catch(() => null)) as { url?: string } | null;
    if (!json?.url) return { ok: false, reason: "URL de mídia ausente" };
    return { ok: true, url: json.url };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "falha media" };
  }
}
