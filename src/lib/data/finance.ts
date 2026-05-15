import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export async function getFinanceData() {
  const { data, error } = await createAdminClient()
    .from("cobrancas")
    .select("*, alunos(nome), pagamentos(valor_pago, data_pagamento, forma_pagamento)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("data_vencimento", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getDelinquencyReport() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await createAdminClient()
    .from("cobrancas")
    .select("id, descricao, competencia, data_vencimento, status, valor_final, alunos(id, matricula_codigo, nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .in("status", ["aberta", "parcial", "vencida"])
    .lte("data_vencimento", today)
    .order("data_vencimento", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const total = rows.reduce((sum, item) => sum + Number(item.valor_final ?? 0), 0);
  const byStudent = new Map<string, { aluno: string; matricula: string; total: number; quantidade: number }>();

  for (const item of rows) {
    const aluno = Array.isArray(item.alunos) ? item.alunos[0] : item.alunos;
    const key = aluno?.id ?? "sem-aluno";
    const current = byStudent.get(key) ?? {
      aluno: aluno?.nome ?? "Sem aluno",
      matricula: aluno?.matricula_codigo ?? "",
      total: 0,
      quantidade: 0
    };
    current.total += Number(item.valor_final ?? 0);
    current.quantidade += 1;
    byStudent.set(key, current);
  }

  return {
    date: today,
    rows,
    total,
    byStudent: Array.from(byStudent.values()).sort((a, b) => b.total - a.total)
  };
}
