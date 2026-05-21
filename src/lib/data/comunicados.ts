import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type ComunicadoRow = {
  id: string;
  titulo: string;
  mensagem: string;
  imagemPath: string | null;
  alcance: "geral" | "individual";
  alunoId: string | null;
  status: "processando" | "concluido";
  totalDestinatarios: number;
  totalEnviados: number;
  totalFalhas: number;
  createdAt: string;
  concluidoEm: string | null;
};

export type DestinatarioMensagem = {
  id: string;
  telefone: string;
  status: "pendente" | "enviada" | "falha";
  erro: string | null;
  alunoId: string | null;
};

function mapComunicado(row: any): ComunicadoRow {
  return {
    id: row.id,
    titulo: row.titulo,
    mensagem: row.mensagem,
    imagemPath: row.imagem_path,
    alcance: row.alcance,
    alunoId: row.aluno_id,
    status: row.status,
    totalDestinatarios: row.total_destinatarios ?? 0,
    totalEnviados: row.total_enviados ?? 0,
    totalFalhas: row.total_falhas ?? 0,
    createdAt: row.created_at,
    concluidoEm: row.concluido_em,
  };
}

export async function listComunicados(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ComunicadoRow[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("comunicados")
    .select("*")
    .eq("escola_id", escolaId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapComunicado);
}

export async function getComunicado(
  id: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ComunicadoRow | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("comunicados")
    .select("*")
    .eq("id", id)
    .eq("escola_id", escolaId)
    .maybeSingle();
  return data ? mapComunicado(data) : null;
}

export async function getDestinatarios(
  comunicadoId: string,
): Promise<DestinatarioMensagem[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("mensagens_whatsapp")
    .select("id, telefone, status, erro, aluno_id")
    .eq("referencia_tipo", "comunicado")
    .eq("referencia_id", comunicadoId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    telefone: r.telefone,
    status: r.status,
    erro: r.erro,
    alunoId: r.aluno_id,
  }));
}
