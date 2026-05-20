import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type NotificacaoSeveridade = "info" | "atencao" | "critico";

export type NotificacaoRow = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  href: string | null;
  severidade: NotificacaoSeveridade;
  lida: boolean;
  criadaEm: string;
};

export async function listNotificacoes(
  perfilId: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
  limit: number = 50
): Promise<NotificacaoRow[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("notificacoes")
    .select("id, tipo, titulo, descricao, href, severidade, lida, criada_em")
    .eq("escola_id", escolaId)
    .or(`perfil_id.eq.${perfilId},perfil_id.is.null`)
    .order("criada_em", { ascending: false })
    .limit(limit);

  return ((data ?? []) as any[]).map((n) => ({
    id: n.id,
    tipo: n.tipo,
    titulo: n.titulo,
    descricao: n.descricao,
    href: n.href,
    severidade: n.severidade as NotificacaoSeveridade,
    lida: !!n.lida,
    criadaEm: n.criada_em,
  }));
}

export async function countNotificacoesNaoLidas(
  perfilId: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<number> {
  const supabase = await createServerClient();
  const { count } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("escola_id", escolaId)
    .or(`perfil_id.eq.${perfilId},perfil_id.is.null`)
    .eq("lida", false);
  return count ?? 0;
}
