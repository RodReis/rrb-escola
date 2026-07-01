"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { sendText, sendImage, sendTemplate } from "@/lib/whatsapp/meta";
import { janelaAberta } from "@/lib/whatsapp/inbox-parser";

// ─── Tipo de retorno ──────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Constantes ───────────────────────────────────────────────────────────────

const IDIOMA = "pt_BR";

// ─── Helper: valida sessão e busca conversa ───────────────────────────────────

async function ctxConversa(conversaId: string) {
  const session = await requirePermission("whatsapp_inbox", "read");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_conversa")
    .select("id, telefone, janela_expira_em")
    .eq("id", conversaId)
    .single();
  if (error || !data) throw new Error("Conversa não encontrada");
  return { session, supabase, conversa: data };
}

// ─── Marcar como lida ─────────────────────────────────────────────────────────

export async function marcarLidaAction(conversaId: string): Promise<ActionResult> {
  try {
    const { supabase } = await ctxConversa(conversaId);
    await supabase
      .from("pipeline_conversa")
      .update({ nao_lidas: 0 })
      .eq("id", conversaId);
    revalidatePath("/whatsapp");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ─── Responder com texto ──────────────────────────────────────────────────────

export async function responderTextoAction(
  conversaId: string,
  texto: string,
): Promise<ActionResult> {
  try {
    const parsed = z.string().min(1).max(4000).safeParse(texto);
    if (!parsed.success) return { ok: false, error: "Mensagem vazia ou longa demais" };

    const { session, supabase, conversa } = await ctxConversa(conversaId);

    if (!janelaAberta(conversa.janela_expira_em, new Date())) {
      return { ok: false, error: "Janela de 24h fechada — use um template" };
    }

    const r = await sendText({ telefone: conversa.telefone, mensagem: parsed.data });

    await supabase.from("pipeline_conversa_mensagem").insert({
      escola_id: session.profile.escola_id,
      conversa_id: conversaId,
      direcao: "saida",
      tipo: "texto",
      texto: parsed.data,
      status: r.ok ? "enviada" : "falha",
      erro: r.ok ? null : r.reason,
      provider_message_id: r.ok ? r.providerMessageId : null,
      enviada_por: session.profile.id,
    });

    await supabase
      .from("pipeline_conversa")
      .update({
        ultima_msg_em: new Date().toISOString(),
        ultima_msg_preview: parsed.data.slice(0, 120),
      })
      .eq("id", conversaId);

    revalidatePath("/whatsapp");
    return r.ok ? { ok: true, data: undefined } : { ok: false, error: r.reason };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ─── Responder com imagem ─────────────────────────────────────────────────────

export async function responderImagemAction(
  conversaId: string,
  imagemUrl: string,
  legenda?: string,
): Promise<ActionResult> {
  try {
    const { session, supabase, conversa } = await ctxConversa(conversaId);

    if (!janelaAberta(conversa.janela_expira_em, new Date())) {
      return { ok: false, error: "Janela de 24h fechada — use um template" };
    }

    const r = await sendImage({ telefone: conversa.telefone, imagemUrl, legenda });

    await supabase.from("pipeline_conversa_mensagem").insert({
      escola_id: session.profile.escola_id,
      conversa_id: conversaId,
      direcao: "saida",
      tipo: "imagem",
      texto: legenda ?? null,
      midia_url: imagemUrl,
      status: r.ok ? "enviada" : "falha",
      erro: r.ok ? null : r.reason,
      provider_message_id: r.ok ? r.providerMessageId : null,
      enviada_por: session.profile.id,
    });

    await supabase
      .from("pipeline_conversa")
      .update({
        ultima_msg_em: new Date().toISOString(),
        ultima_msg_preview: "📷 Imagem",
      })
      .eq("id", conversaId);

    revalidatePath("/whatsapp");
    return r.ok ? { ok: true, data: undefined } : { ok: false, error: r.reason };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ─── Responder com template ────────────────────────────────────────────────────

export async function responderTemplateAction(
  conversaId: string,
  templateId: string,
  variaveis: string[],
): Promise<ActionResult> {
  try {
    const { session, supabase, conversa } = await ctxConversa(conversaId);

    const tpl = await supabase
      .from("pipeline_template_whatsapp")
      .select("nome_template, descricao")
      .eq("id", templateId)
      .single();

    if (tpl.error || !tpl.data) return { ok: false, error: "Template não encontrado" };

    const r = await sendTemplate({
      telefone: conversa.telefone,
      templateName: tpl.data.nome_template,
      idioma: IDIOMA,
      variaveis,
    });

    await supabase.from("pipeline_conversa_mensagem").insert({
      escola_id: session.profile.escola_id,
      conversa_id: conversaId,
      direcao: "saida",
      tipo: "template",
      texto: tpl.data.descricao,
      status: r.ok ? "enviada" : "falha",
      erro: r.ok ? null : r.reason,
      provider_message_id: r.ok ? r.providerMessageId : null,
      enviada_por: session.profile.id,
    });

    await supabase
      .from("pipeline_conversa")
      .update({
        ultima_msg_em: new Date().toISOString(),
        ultima_msg_preview: tpl.data.descricao.slice(0, 120),
      })
      .eq("id", conversaId);

    revalidatePath("/whatsapp");
    return r.ok ? { ok: true, data: undefined } : { ok: false, error: r.reason };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ─── Atribuir conversa a um perfil ───────────────────────────────────────────

export async function atribuirConversaAction(
  conversaId: string,
  perfilId: string | null,
): Promise<ActionResult> {
  try {
    const { supabase } = await ctxConversa(conversaId);
    await supabase
      .from("pipeline_conversa")
      .update({ assigned_to: perfilId })
      .eq("id", conversaId);
    revalidatePath("/whatsapp");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ─── Arquivar conversa ────────────────────────────────────────────────────────

export async function arquivarConversaAction(conversaId: string): Promise<ActionResult> {
  try {
    const { supabase } = await ctxConversa(conversaId);
    await supabase
      .from("pipeline_conversa")
      .update({ status: "arquivada" })
      .eq("id", conversaId);
    revalidatePath("/whatsapp");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}
