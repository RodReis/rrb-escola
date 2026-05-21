import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { Alvo } from "@/lib/comunicados/destinatarios";

export type ComunicadoRow = {
  id: string;
  titulo: string;
  mensagem: string;
  imagemPath: string | null;
  alcance: "geral" | "individual" | "segmentado";
  alunoId: string | null;
  alvos: Alvo[];
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
    alvos: Array.isArray(row.alvos) ? row.alvos : [],
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
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<DestinatarioMensagem[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("mensagens_whatsapp")
    .select("id, telefone, status, erro, aluno_id")
    .eq("escola_id", escolaId)
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

export type TurmaLite = { id: string; nome: string; anoLetivo: number; serieNome: string };
export type SerieLite = { id: string; nome: string };

export async function listTurmasESeries(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<{ turmas: TurmaLite[]; series: SerieLite[] }> {
  const supabase = await createServerClient();

  const [turmasRes, seriesRes] = await Promise.all([
    supabase
      .from("turmas")
      .select("id, nome, ano_letivo, series(nome)")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("ano_letivo", { ascending: false }),
    supabase
      .from("series")
      .select("id, nome")
      .eq("escola_id", escolaId)
      .order("ordem"),
  ]);

  const turmas: TurmaLite[] = ((turmasRes.data ?? []) as any[]).map((t) => ({
    id: t.id,
    nome: t.nome,
    anoLetivo: t.ano_letivo,
    serieNome: Array.isArray(t.series) ? (t.series[0]?.nome ?? "") : (t.series?.nome ?? ""),
  }));

  const series: SerieLite[] = ((seriesRes.data ?? []) as any[]).map((s) => ({
    id: s.id,
    nome: s.nome,
  }));

  return { turmas, series };
}
