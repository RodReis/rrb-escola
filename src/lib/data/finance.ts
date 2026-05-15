import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export async function getFinanceData() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cobrancas")
    .select("*, alunos(nome, matricula_codigo), pagamentos(id, valor_pago, data_pagamento, forma_pagamento, observacao, cancelado_em, cancelado_por, motivo_cancelamento, registrado_por, perfis:registrado_por(nome))")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("data_vencimento", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getChargeWithPayments(cobrancaId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cobrancas")
    .select(`
      *,
      alunos(id, nome, matricula_codigo),
      pagamentos(id, valor_pago, data_pagamento, forma_pagamento, observacao, cancelado_em, cancelado_por, motivo_cancelamento, registrado_por, perfis:registrado_por(nome))
    `)
    .eq("id", cobrancaId)
    .single();

  if (error) throw error;
  return data;
}

export async function getStudentStatement(alunoId: string, de: string, ate: string) {
  const supabase = await createServerClient();

  const charges = await supabase
    .from("cobrancas")
    .select(`
      id, descricao, competencia, numero_parcela, valor_final, data_vencimento, status,
      pagamentos(id, valor_pago, data_pagamento, forma_pagamento, cancelado_em, registrado_por, perfis:registrado_por(nome))
    `)
    .eq("aluno_id", alunoId)
    .gte("data_vencimento", de)
    .lte("data_vencimento", ate)
    .order("data_vencimento", { ascending: true });

  if (charges.error) throw charges.error;

  const aluno = await supabase
    .from("alunos")
    .select("id, nome, matricula_codigo")
    .eq("id", alunoId)
    .single();

  if (aluno.error) throw aluno.error;

  return {
    aluno: aluno.data,
    de,
    ate,
    charges: charges.data ?? []
  };
}

export async function getDelinquencyReport() {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createServerClient();
  const { data, error } = await supabase
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
