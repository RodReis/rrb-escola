import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export async function getEnrollments() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("matriculas")
    .select("*, alunos(nome, matricula_codigo), series(nome), turmas(nome), planos(nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("data_matricula", { ascending: false });

  if (error) throw error;
  return data ?? [];
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
