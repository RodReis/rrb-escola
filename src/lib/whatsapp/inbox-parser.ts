import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizarTelefone } from "./telefone";
export { janelaAberta } from "./janela";

export function validarAssinaturaWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !signature.startsWith("sha256=")) return false;
  const esperado = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type EventoInbound = {
  telefone: string;
  nome: string | null;
  tipo: "texto" | "imagem";
  texto: string | null;
  mediaId: string | null;
  providerMessageId: string;
};

type WebhookValue = {
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: {
    from?: string;
    id?: string;
    type?: string;
    text?: { body?: string };
    image?: { id?: string; caption?: string };
  }[];
  statuses?: unknown[];
};

export function parsearEventoWebhook(payload: unknown): EventoInbound[] {
  const eventos: EventoInbound[] = [];
  const root = payload as { entry?: { changes?: { value?: WebhookValue }[] }[] };
  for (const entry of root?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const nome = value?.contacts?.[0]?.profile?.name ?? null;
      for (const msg of value?.messages ?? []) {
        if (!msg.from || !msg.id) continue;
        if (msg.type === "text" && msg.text?.body) {
          eventos.push({
            telefone: msg.from, nome, tipo: "texto",
            texto: msg.text.body, mediaId: null, providerMessageId: msg.id,
          });
        } else if (msg.type === "image" && msg.image?.id) {
          eventos.push({
            telefone: msg.from, nome, tipo: "imagem",
            texto: msg.image.caption ?? null, mediaId: msg.image.id, providerMessageId: msg.id,
          });
        }
        // outros tipos (audio, video, document, status) são ignorados nesta fase
      }
    }
  }
  return eventos;
}

export function casarConversa(
  telefone: string,
  leads: { id: string; telefone: string | null }[],
  responsaveis: { id: string; aluno_id: string; telefone: string | null }[],
): { lead_id: string | null; aluno_id: string | null; responsavel_id: string | null } {
  const alvo = normalizarTelefone(telefone);
  const lead = leads.find((l) => l.telefone && normalizarTelefone(l.telefone) === alvo);
  if (lead) return { lead_id: lead.id, aluno_id: null, responsavel_id: null };
  const resp = responsaveis.find((r) => r.telefone && normalizarTelefone(r.telefone) === alvo);
  if (resp) return { lead_id: null, aluno_id: resp.aluno_id, responsavel_id: resp.id };
  return { lead_id: null, aluno_id: null, responsavel_id: null };
}

