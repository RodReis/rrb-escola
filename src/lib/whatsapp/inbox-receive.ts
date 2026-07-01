import "server-only";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { normalizarTelefone } from "./telefone";
import { casarConversa, type EventoInbound } from "./inbox-parser";
import { getMediaUrl } from "./meta";

const JANELA_HORAS = 24;
const BUCKET = "whatsapp-inbox";

type SupabaseAdmin = { from: (t: string) => any; storage: any };

// Baixa a mídia da Meta, sobe no bucket e devolve a URL assinada (ou null em falha).
async function baixarMidia(
  supabase: SupabaseAdmin,
  mediaId: string,
  conversaId: string,
): Promise<string | null> {
  const media = await getMediaUrl(mediaId);
  if (!media.ok) return null;
  try {
    const token = process.env.META_WHATSAPP_TOKEN!;
    const res = await fetch(media.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 5 * 1024 * 1024) return null; // limite 5MB
    const path = `${conversaId}/${mediaId}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: res.headers.get("content-type") ?? "image/jpeg",
      upsert: true,
    });
    if (up.error) return null;
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
    return signed.data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function processarEventoInbound(
  evento: EventoInbound,
  supabase: SupabaseAdmin,
): Promise<void> {
  const telefone = normalizarTelefone(evento.telefone) ?? evento.telefone;

  // Dedup: se já existe mensagem com esse provider_message_id, ignora.
  const existente = await supabase
    .from("pipeline_conversa_mensagem")
    .select("id")
    .eq("provider_message_id", evento.providerMessageId)
    .maybeSingle();
  if (existente.data) return;

  // Casa vínculo (lead + responsável).
  // pipeline_lead não tem coluna telefone; o telefone do lead fica em pipeline_lead_responsavel.
  // Fazemos join via card_id para obter o pipeline_lead.id associado.
  // responsaveis_aluno não tem escola_id; buscamos todos e casamos em memória.
  const [leadRespsRes, respsRes] = await Promise.all([
    supabase
      .from("pipeline_lead_responsavel")
      .select("card_id, telefone, whatsapp, pipeline_lead!inner(id)")
      .eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase
      .from("responsaveis_aluno")
      .select("id, aluno_id, telefone, celular"),
  ]);

  // Constrói lista de leads com { id, telefone } usando whatsapp preferido a telefone.
  const leads: { id: string; telefone: string | null }[] = (leadRespsRes.data ?? []).map(
    (r: any) => ({
      id: r.pipeline_lead?.id ?? "",
      telefone: r.whatsapp ?? r.telefone ?? null,
    }),
  );

  const resps = (respsRes.data ?? []).map((r: any) => ({
    id: r.id,
    aluno_id: r.aluno_id,
    telefone: r.celular ?? r.telefone,
  }));
  const vinculo = casarConversa(telefone, leads, resps);

  const agora = new Date();
  const janelaExpira = new Date(agora.getTime() + JANELA_HORAS * 3600 * 1000).toISOString();
  const preview = evento.tipo === "imagem" ? "📷 Imagem" : (evento.texto ?? "").slice(0, 120);

  // Upsert da conversa (única por escola+telefone).
  const conversaExistente = await supabase
    .from("pipeline_conversa")
    .select("id, nao_lidas")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("telefone", telefone)
    .maybeSingle();

  let conversaId: string;
  if (conversaExistente.data) {
    conversaId = conversaExistente.data.id;
    await supabase
      .from("pipeline_conversa")
      .update({
        nao_lidas: (conversaExistente.data.nao_lidas ?? 0) + 1,
        janela_expira_em: janelaExpira,
        ultima_msg_em: agora.toISOString(),
        ultima_msg_preview: preview,
        nome_whatsapp: evento.nome ?? undefined,
        ...vinculo,
      })
      .eq("id", conversaId);
  } else {
    const nova = await supabase
      .from("pipeline_conversa")
      .insert({
        escola_id: DEFAULT_SCHOOL_ID,
        telefone,
        nome_whatsapp: evento.nome,
        nao_lidas: 1,
        janela_expira_em: janelaExpira,
        ultima_msg_em: agora.toISOString(),
        ultima_msg_preview: preview,
        ...vinculo,
      })
      .select("id")
      .single();
    if (nova.error || !nova.data) return;
    conversaId = nova.data.id;
  }

  // Baixa mídia se for imagem.
  let midiaUrl: string | null = null;
  let texto = evento.texto;
  if (evento.tipo === "imagem" && evento.mediaId) {
    midiaUrl = await baixarMidia(supabase, evento.mediaId, conversaId);
    if (!midiaUrl) texto = texto ?? "[imagem não recebida]";
  }

  // Insere a mensagem de entrada.
  await supabase.from("pipeline_conversa_mensagem").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    conversa_id: conversaId,
    direcao: "entrada",
    tipo: evento.tipo,
    texto,
    midia_url: midiaUrl,
    provider_message_id: evento.providerMessageId,
  });
}
