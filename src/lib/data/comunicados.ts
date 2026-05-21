import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { AlvosSegmentado } from "@/lib/comunicados/destinatarios";

export type ComunicadoRow = {
  id: string;
  titulo: string;
  mensagem: string;
  imagemPath: string | null;
  alcance: "geral" | "individual" | "segmentado";
  alunoId: string | null;
  alvos: AlvosSegmentado;
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

function normalizarAlvos(raw: unknown): AlvosSegmentado {
  // Formato antigo: array de {tipo,id}. Formato novo: {alunos, criterio}.
  if (Array.isArray(raw)) return { alunos: [], criterio: [] };
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<AlvosSegmentado>;
    return {
      alunos: Array.isArray(obj.alunos) ? obj.alunos : [],
      criterio: Array.isArray(obj.criterio) ? obj.criterio : [],
    };
  }
  return { alunos: [], criterio: [] };
}

function mapComunicado(row: any): ComunicadoRow {
  return {
    id: row.id,
    titulo: row.titulo,
    mensagem: row.mensagem,
    imagemPath: row.imagem_path,
    alcance: row.alcance,
    alunoId: row.aluno_id,
    alvos: normalizarAlvos(row.alvos),
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

export type TurmaLite = { id: string; nome: string; anoLetivo: number; serieId: string; serieNome: string };
export type SerieLite = { id: string; nome: string };

export async function listTurmasESeries(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<{ turmas: TurmaLite[]; series: SerieLite[] }> {
  const supabase = await createServerClient();
  const anoCorrente = new Date().getFullYear();

  const { data: turmasData } = await supabase
    .from("turmas")
    .select("id, nome, ano_letivo, serie_id, series(nome)")
    .eq("escola_id", escolaId)
    .eq("ativo", true)
    .eq("ano_letivo", anoCorrente)
    .order("nome");

  const turmas: TurmaLite[] = ((turmasData ?? []) as any[]).map((t) => ({
    id: t.id,
    nome: t.nome,
    anoLetivo: t.ano_letivo,
    serieId: t.serie_id,
    serieNome: Array.isArray(t.series) ? (t.series[0]?.nome ?? "") : (t.series?.nome ?? ""),
  }));

  // Séries do ano corrente = as que têm ao menos uma turma no ano.
  const serieMap = new Map<string, string>();
  for (const t of turmas) {
    if (t.serieId && !serieMap.has(t.serieId)) serieMap.set(t.serieId, t.serieNome);
  }
  const series: SerieLite[] = Array.from(serieMap.entries()).map(([id, nome]) => ({ id, nome }));

  return { turmas, series };
}

export type AlunoLite = { id: string; nome: string };

export async function listAlunosDaTurma(
  turmaId: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<AlunoLite[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("alunos")
    .select("id, nome, matriculas!inner(status, turma_id)")
    .eq("escola_id", escolaId)
    .eq("matriculas.status", "ativa")
    .eq("matriculas.turma_id", turmaId)
    .order("nome");

  const vistos = new Set<string>();
  const alunos: AlunoLite[] = [];
  for (const a of (data ?? []) as Array<{ id: string; nome: string }>) {
    if (vistos.has(a.id)) continue;
    vistos.add(a.id);
    alunos.push({ id: a.id, nome: a.nome });
  }
  return alunos;
}
