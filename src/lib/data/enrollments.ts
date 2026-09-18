import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { getSignedFotoUrls } from "@/lib/storage/photos";

export async function getEnrollments(filters?: { status?: string; nome?: string }) {
  const supabase = await createServerClient();
  let query = supabase
    .from("matriculas")
    .select("*, alunos(nome, matricula_codigo, foto_url), series(nome), turmas(nome), planos(nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("data_matricula", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;

  const rawRows = data ?? [];
  const fotoPaths = rawRows.map((m) => m.alunos?.foto_url ?? null);
  const signedMap = await getSignedFotoUrls(fotoPaths);

  let rows = rawRows.map((m) => ({
    ...m,
    alunos: m.alunos
      ? {
          ...m.alunos,
          foto_url: m.alunos.foto_url ? (signedMap.get(m.alunos.foto_url) ?? null) : null,
        }
      : m.alunos,
  }));

  if (filters?.nome) {
    const q = filters.nome.toLowerCase();
    rows = rows.filter(
      (m) =>
        (m.alunos?.nome ?? "").toLowerCase().includes(q) ||
        (m.alunos?.matricula_codigo ?? "").includes(q)
    );
  }

  return rows;
}

export async function getEnrollmentDetail(id: string) {
  const supabase = await createServerClient();
  const [enrollment, charges, payments, attendance, history] = await Promise.all([
    supabase
      .from("matriculas")
      .select("*, alunos(id, nome, matricula_codigo), series(id, nome), turmas(id, nome, ano_letivo, turno), planos(id, nome, valor_matricula, valor_mensalidade)")
      .eq("id", id)
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .single(),
    supabase
      .from("cobrancas")
      .select("*")
      .eq("matricula_id", id)
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .order("data_vencimento", { ascending: true }),
    supabase
      .from("pagamentos")
      .select("*, cobrancas(descricao, competencia)")
      .eq("matricula_id", id)
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .order("data_pagamento", { ascending: false }),
    supabase
      .from("frequencias")
      .select("*")
      .eq("matricula_id", id)
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .order("data_aula", { ascending: false })
      .limit(120),
    supabase
      .from("historico_matriculas")
      .select("*")
      .eq("matricula_id", id)
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .order("created_at", { ascending: false })
  ]);

  if (enrollment.error) throw enrollment.error;
  if (charges.error) throw charges.error;
  if (payments.error) throw payments.error;
  if (attendance.error) throw attendance.error;
  if (history.error) throw history.error;

  return {
    enrollment: enrollment.data,
    charges: charges.data ?? [],
    payments: payments.data ?? [],
    attendance: attendance.data ?? [],
    history: history.data ?? [],
    totals: {
      cobrancas: charges.data?.length ?? 0,
      valorCobrado: (charges.data ?? []).reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0),
      valorPago: (payments.data ?? []).filter((p) => !p.cancelado_em).reduce((sum, p) => sum + Number(p.valor_pago ?? 0), 0),
      presencas: (attendance.data ?? []).filter((item) => item.presente).length,
      faltas: (attendance.data ?? []).filter((item) => !item.presente).length
    }
  };
}

export type AlunoLoteRow = {
  id: string;
  nome: string;
  matricula_id: string;
  foto_url: string | null;
};

export async function listAlunosCandidatosLote(
  turma_id: string,
  ano_letivo: number
): Promise<AlunoLoteRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("matriculas")
    .select("id, alunos!inner(id, nome, foto_url)")
    .eq("turma_id", turma_id)
    .eq("ano_letivo", ano_letivo)
    .eq("status", "ativa")
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  if (error) throw error;

  // !inner join — Supabase returns relation as array; extract first element per row
  type AlunoRel = { id: string; nome: string; foto_url: string | null };
  const candidatos = (data ?? []).map((m) => {
    const aluno = (Array.isArray(m.alunos) ? m.alunos[0] : m.alunos) as AlunoRel;
    return { matricula_id: m.id, alunoId: aluno.id, alunoNome: aluno.nome, fotoUrl: aluno.foto_url ?? null };
  });

  if (candidatos.length === 0) return [];

  const alunoIds = candidatos.map((c) => c.alunoId);

  const { data: jaMatriculados, error: err2 } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .in("aluno_id", alunoIds)
    .eq("ano_letivo", ano_letivo + 1)
    .eq("status", "ativa")
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  if (err2) throw err2;

  const jaMatriculadosSet = new Set((jaMatriculados ?? []).map((m) => m.aluno_id));

  return candidatos
    .filter((c) => !jaMatriculadosSet.has(c.alunoId))
    .map((c) => ({ id: c.alunoId, nome: c.alunoNome, matricula_id: c.matricula_id, foto_url: c.fotoUrl }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Plano mais usado nas matrículas ativas da turma — contexto para escolher o plano do ano seguinte. */
export async function getPlanoPredominanteDaTurma(
  turma_id: string,
  ano_letivo: number,
): Promise<string | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("matriculas")
    .select("planos(nome)")
    .eq("turma_id", turma_id)
    .eq("ano_letivo", ano_letivo)
    .eq("status", "ativa")
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  if (error) throw error;

  const contagem: Record<string, number> = {};
  for (const row of data ?? []) {
    const plano = (Array.isArray(row.planos) ? row.planos[0] : row.planos) as { nome: string } | null;
    if (!plano?.nome) continue;
    contagem[plano.nome] = (contagem[plano.nome] ?? 0) + 1;
  }

  let predominante: string | null = null;
  let maior = 0;
  for (const nome of Object.keys(contagem)) {
    if (contagem[nome] > maior) {
      maior = contagem[nome];
      predominante = nome;
    }
  }
  return predominante;
}
