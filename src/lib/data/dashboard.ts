import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export async function getDashboard() {
  const supabase = await createServerClient();

  const [alunos, matriculas, abertas, pagas, chartRows] = await Promise.all([
    supabase.from("alunos").select("id", { count: "exact", head: true }).eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase.from("matriculas").select("id", { count: "exact", head: true }).eq("escola_id", DEFAULT_SCHOOL_ID).eq("status", "ativa"),
    supabase.from("cobrancas").select("valor_final").eq("escola_id", DEFAULT_SCHOOL_ID).in("status", ["aberta", "vencida", "parcial"]),
    supabase.from("pagamentos").select("valor_pago").eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase.from("cobrancas").select("competencia, valor_final, status").eq("escola_id", DEFAULT_SCHOOL_ID).order("competencia")
  ]);

  const totalAberto = (abertas.data ?? []).reduce((sum, item) => sum + Number(item.valor_final ?? 0), 0);
  const totalPago = (pagas.data ?? []).reduce((sum, item) => sum + Number(item.valor_pago ?? 0), 0);
  const chart = new Map<string, { competencia: string; aberto: number; pago: number }>();

  for (const item of chartRows.data ?? []) {
    const row = chart.get(item.competencia) ?? { competencia: item.competencia, aberto: 0, pago: 0 };
    if (item.status === "paga") row.pago += Number(item.valor_final ?? 0);
    else row.aberto += Number(item.valor_final ?? 0);
    chart.set(item.competencia, row);
  }

  return {
    alunos: alunos.count ?? 0,
    matriculas: matriculas.count ?? 0,
    totalAberto,
    totalPago,
    chart: Array.from(chart.values())
  };
}
