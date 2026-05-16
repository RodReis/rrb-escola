import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const competencia = `${year}-${pad(month)}`;
  const firstDay = `${year}-${pad(month)}-01`;
  const lastDay = `${year}-${pad(month)}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  return { competencia, firstDay, lastDay };
}

export async function getDashboard() {
  const supabase = await createServerClient();
  const { competencia, firstDay, lastDay } = currentMonthRange();

  const [alunos, matriculas, abertas, pagas, chartRows, previstoMes, recebidoMes] = await Promise.all([
    supabase.from("alunos").select("id", { count: "exact", head: true }).eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase.from("matriculas").select("id", { count: "exact", head: true }).eq("escola_id", DEFAULT_SCHOOL_ID).eq("status", "ativa"),
    supabase.from("cobrancas").select("valor_final").eq("escola_id", DEFAULT_SCHOOL_ID).eq("competencia", competencia).in("status", ["aberta", "vencida", "parcial"]),
    supabase.from("pagamentos").select("valor_pago").eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase.from("cobrancas").select("competencia, valor_final, status").eq("escola_id", DEFAULT_SCHOOL_ID).order("competencia"),
    supabase.from("cobrancas").select("valor_final").eq("escola_id", DEFAULT_SCHOOL_ID).eq("competencia", competencia).neq("status", "cancelada"),
    supabase.from("pagamentos").select("valor_pago").eq("escola_id", DEFAULT_SCHOOL_ID).gte("data_pagamento", firstDay).lte("data_pagamento", lastDay).is("cancelado_em", null),
  ]);

  const totalAberto = (abertas.data ?? []).reduce((sum, item) => sum + Number(item.valor_final ?? 0), 0);
  const totalPago = (pagas.data ?? []).reduce((sum, item) => sum + Number(item.valor_pago ?? 0), 0);
  const previstoMesTotal = (previstoMes.data ?? []).reduce((sum, item) => sum + Number(item.valor_final ?? 0), 0);
  const recebidoMesTotal = (recebidoMes.data ?? []).reduce((sum, item) => sum + Number(item.valor_pago ?? 0), 0);

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
    previstoMes: previstoMesTotal,
    recebidoMes: recebidoMesTotal,
    mesCompetencia: competencia,
    chart: Array.from(chart.values())
  };
}
