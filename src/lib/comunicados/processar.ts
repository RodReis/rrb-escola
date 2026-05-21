import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/whatsapp/meta";

const TEMPLATE_COMUNICADO = process.env.META_TEMPLATE_COMUNICADO ?? "comunicado_escola";
const IDIOMA = "pt_BR";

const TAMANHO_LOTE = 30;

export type ResultadoLote = {
  processadas: number;
  enviadas: number;
  falhas: number;
};

type MsgPendente = {
  id: string;
  telefone: string;
  mensagem: string;
  imagem_url: string | null;
  referencia_id: string;
};

async function sendTemplateComunicado(
  msg: MsgPendente,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<{ ok: boolean }> {
  const resultado = await sendTemplate({
    telefone: msg.telefone,
    templateName: TEMPLATE_COMUNICADO,
    idioma: IDIOMA,
    variaveis: [msg.mensagem],
    imagemUrl: msg.imagem_url ?? undefined,
  });

  if (resultado.ok) {
    await supabase
      .from("mensagens_whatsapp")
      .update({
        status: "enviada",
        provider_message_id: resultado.providerMessageId,
        enviada_em: new Date().toISOString(),
      })
      .eq("id", msg.id);
    return { ok: true };
  }

  await supabase
    .from("mensagens_whatsapp")
    .update({
      status: "falha",
      erro: resultado.reason,
      enviada_em: new Date().toISOString(),
    })
    .eq("id", msg.id);
  return { ok: false };
}

export async function processarLote(): Promise<ResultadoLote> {
  const supabase = createAdminClient();

  // Pega um lote de mensagens pendentes de comunicados.
  const { data: pendentes } = await supabase
    .from("mensagens_whatsapp")
    .select("id, telefone, mensagem, imagem_url, referencia_id")
    .eq("referencia_tipo", "comunicado")
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(TAMANHO_LOTE);

  const lote = pendentes ?? [];
  if (lote.length === 0) {
    return { processadas: 0, enviadas: 0, falhas: 0 };
  }

  let enviadas = 0;
  let falhas = 0;
  const comunicadosTocados = new Set<string>();

  for (const msg of lote) {
    comunicadosTocados.add(msg.referencia_id);

    const resultado = await sendTemplateComunicado(msg, supabase);

    if (resultado.ok) {
      enviadas += 1;
    } else {
      falhas += 1;
    }
  }

  // Recalcula contadores dos comunicados tocados.
  for (const comunicadoId of Array.from(comunicadosTocados)) {
    const { count: enviadasTotal } = await supabase
      .from("mensagens_whatsapp")
      .select("id", { count: "exact", head: true })
      .eq("referencia_tipo", "comunicado")
      .eq("referencia_id", comunicadoId)
      .eq("status", "enviada");

    const { count: falhasTotal } = await supabase
      .from("mensagens_whatsapp")
      .select("id", { count: "exact", head: true })
      .eq("referencia_tipo", "comunicado")
      .eq("referencia_id", comunicadoId)
      .eq("status", "falha");

    const { count: pendentesTotal } = await supabase
      .from("mensagens_whatsapp")
      .select("id", { count: "exact", head: true })
      .eq("referencia_tipo", "comunicado")
      .eq("referencia_id", comunicadoId)
      .eq("status", "pendente");

    const concluido = (pendentesTotal ?? 0) === 0;
    await supabase
      .from("comunicados")
      .update({
        total_enviados: enviadasTotal ?? 0,
        total_falhas: falhasTotal ?? 0,
        status: concluido ? "concluido" : "processando",
        concluido_em: concluido ? new Date().toISOString() : null,
      })
      .eq("id", comunicadoId);
  }

  return { processadas: lote.length, enviadas, falhas };
}
