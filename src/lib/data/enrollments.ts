import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

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

  let rows = data ?? [];
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
};

export async function listAlunosCandidatosLote(
  turma_id: string,
  ano_letivo: number
): Promise<AlunoLoteRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("matriculas")
    .select("id, alunos!inner(id, nome)")
    .eq("turma_id", turma_id)
    .eq("ano_letivo", ano_letivo)
    .eq("status", "ativa")
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  if (error) throw error;

  const candidatos = data ?? [];

  // Filter out students already enrolled next year
  const alunoIds = candidatos.map((m) => (m.alunos as { id: string; nome: string }).id);
  if (alunoIds.length === 0) return [];

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
    .filter((m) => !jaMatriculadosSet.has((m.alunos as { id: string; nome: string }).id))
    .map((m) => ({
      id: (m.alunos as { id: string; nome: string }).id,
      nome: (m.alunos as { id: string; nome: string }).nome,
      matricula_id: m.id,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
