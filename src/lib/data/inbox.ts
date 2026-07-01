import "server-only";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";

const BUCKET = "whatsapp-inbox";
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hora — suficiente para exibir a thread aberta

export type ConversaResumo = {
  id: string;
  telefone: string;
  nome_whatsapp: string | null;
  lead_id: string | null;
  aluno_id: string | null;
  responsavel_id: string | null;
  assigned_to: string | null;
  nao_lidas: number;
  janela_expira_em: string | null;
  ultima_msg_em: string;
  ultima_msg_preview: string | null;
};

export type MensagemThread = {
  id: string;
  direcao: "entrada" | "saida";
  tipo: "texto" | "imagem" | "template";
  texto: string | null;
  midia_url: string | null;
  status: string | null;
  created_at: string;
};

export async function getConversas(
  filtro: "todas" | "minhas" | "nao_lidas",
): Promise<ConversaResumo[]> {
  const session = await requirePermission("whatsapp_inbox", "read");
  const supabase = await createServerClient();
  let q = supabase
    .from("pipeline_conversa")
    .select(
      "id, telefone, nome_whatsapp, lead_id, aluno_id, responsavel_id, assigned_to, nao_lidas, janela_expira_em, ultima_msg_em, ultima_msg_preview",
    )
    .eq("status", "aberta")
    .order("ultima_msg_em", { ascending: false });

  if (filtro === "minhas") q = q.eq("assigned_to", session.profile.id);
  if (filtro === "nao_lidas") q = q.gt("nao_lidas", 0);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ConversaResumo[];
}

export async function getMensagensConversa(conversaId: string): Promise<MensagemThread[]> {
  await requirePermission("whatsapp_inbox", "read");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_conversa_mensagem")
    .select("id, direcao, tipo, texto, midia_url, status, created_at")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const mensagens = (data ?? []) as MensagemThread[];

  // midia_url guarda o PATH do objeto no Storage (bucket privado). Gera signed URL curta
  // sob demanda, em lote, para não expor URLs de longa duração no banco.
  return Promise.all(
    mensagens.map(async (msg) => {
      if (msg.tipo !== "imagem" || !msg.midia_url) return msg;
      try {
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(msg.midia_url, SIGNED_URL_EXPIRY);
        if (signErr || !signed?.signedUrl) return { ...msg, midia_url: null };
        return { ...msg, midia_url: signed.signedUrl };
      } catch {
        return { ...msg, midia_url: null };
      }
    }),
  );
}
