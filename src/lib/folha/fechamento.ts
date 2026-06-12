import { createServerClient } from "@/lib/supabase/server";
import { nthDiaUtil } from "@/lib/folha/date-utils";

export async function validarRun(runId: string): Promise<string[]> {
  const supabase = await createServerClient();

  const { data: run, error: runErr } = await supabase
    .from("folha_runs")
    .select("tipo")
    .eq("id", runId)
    .single();
  if (runErr) throw runErr;

  const tipoRun = (run as unknown as { tipo: string }).tipo ?? "mensal";

  const { data: itens, error } = await supabase
    .from("folha_itens")
    .select(
      "id, liquido, total_proventos, periodo_aquisitivo_id, folha_contratos(id, employees(name)), folha_lancamentos(folha_rubricas(codigo))",
    )
    .eq("run_id", runId)
    .eq("status", "ativo");
  if (error) throw error;

  const pendencias: string[] = [];

  for (const i of itens ?? []) {
    type ItemRow = {
      id: string;
      liquido: number;
      total_proventos: number;
      periodo_aquisitivo_id: string | null;
      folha_contratos: { id: string; employees: { name: string } | null } | null;
      folha_lancamentos: Array<{ folha_rubricas: { codigo: string } | null }>;
    };
    const row = i as unknown as ItemRow;
    const nome = row.folha_contratos?.employees?.name ?? "?";

    if (Number(row.liquido) < 0) pendencias.push(`${nome}: líquido negativo`);
    if (Number(row.total_proventos) === 0) pendencias.push(`${nome}: sem proventos`);

    if (tipoRun === "ferias" && !row.periodo_aquisitivo_id) {
      pendencias.push(`${nome}: item de férias sem período aquisitivo vinculado`);
    }

    if (tipoRun === "decimo_2a") {
      const codigos = row.folha_lancamentos
        .map((l) => l.folha_rubricas?.codigo)
        .filter(Boolean);
      const tem1aParcela = codigos.includes("decimo_1a_parcela") || codigos.includes("desconto_adiantamento_13");
      const temDesconto = codigos.includes("desconto_adiantamento_13");
      if (tem1aParcela && !temDesconto) {
        pendencias.push(`${nome}: 13º com adiantamento mas sem desconto_adiantamento_13`);
      }
    }
  }

  return pendencias;
}

type FolhaConfig = {
  categoria_despesa_folha: string | null;
  categoria_despesa_encargos: string | null;
  regra_pagamento: { tipo: string; n: number };
  feriados_locais: string[];
  dia_vencimento_gps: number;
  dia_vencimento_fgts: number;
};

export type RunParaDespesas = {
  id: string;
  escola_id: string;
  competencia: string;
  total_liquido: number;
  folha_config: FolhaConfig;
};

export async function gerarDespesasDaRun(run: RunParaDespesas): Promise<void> {
  const supabase = await createServerClient();
  const cfg = run.folha_config;
  if (!cfg.categoria_despesa_folha) throw new Error("Configure a categoria de despesa da folha");

  const vencFolha = nthDiaUtil(run.competencia, cfg.regra_pagamento.n, cfg.feriados_locais);
  const [ano, mes] = run.competencia.split("-").map(Number);
  const proxMes =
    mes === 12
      ? `${ano + 1}-01`
      : `${ano}-${String(mes + 1).padStart(2, "0")}`;

  const { data: itens, error: itensErr } = await supabase
    .from("folha_itens")
    .select("base_inss, base_fgts")
    .eq("run_id", run.id)
    .eq("status", "ativo");
  if (itensErr) throw itensErr;

  type ItemBases = { base_inss: number; base_fgts: number };
  const rows = (itens ?? []) as unknown as ItemBases[];
  const baseInss = rows.reduce((a, i) => a + Number(i.base_inss), 0);
  const baseFgts = rows.reduce((a, i) => a + Number(i.base_fgts), 0);

  const linhas = [
    {
      descricao: `Folha ${run.competencia} — líquidos`,
      valor: run.total_liquido,
      categoria_id: cfg.categoria_despesa_folha,
      data_vencimento: vencFolha,
    },
    {
      descricao: `GPS/INSS ${run.competencia}`,
      valor: Math.round(baseInss * 0.2 * 100) / 100,
      categoria_id: cfg.categoria_despesa_encargos ?? cfg.categoria_despesa_folha,
      data_vencimento: `${proxMes}-${String(cfg.dia_vencimento_gps).padStart(2, "0")}`,
    },
    {
      descricao: `FGTS ${run.competencia}`,
      valor: Math.round(baseFgts * 0.08 * 100) / 100,
      categoria_id: cfg.categoria_despesa_encargos ?? cfg.categoria_despesa_folha,
      data_vencimento: `${proxMes}-${String(cfg.dia_vencimento_fgts).padStart(2, "0")}`,
    },
  ].filter((l) => l.valor > 0);

  const { error: insErr } = await supabase.from("despesas").insert(
    linhas.map((l) => ({
      ...l,
      escola_id: run.escola_id,
      competencia: run.competencia,
      status: "aberta" as const,
      tipo: "fixa" as const,
      folha_run_id: run.id,
    })),
  );
  if (insErr) throw insErr;
}

export async function gravarProvisoes(runId: string, competencia: string): Promise<void> {
  const supabase = await createServerClient();
  const { data: itens, error } = await supabase
    .from("folha_itens")
    .select("contrato_id, base_fgts")
    .eq("run_id", runId)
    .eq("status", "ativo");
  if (error) throw error;

  type ItemProvisao = { contrato_id: string; base_fgts: number };
  for (const raw of itens ?? []) {
    const i = raw as unknown as ItemProvisao;
    const base = Number(i.base_fgts);
    if (base <= 0) continue;
    const tipos = [
      { tipo: "decimo_terceiro", valor: base / 12 },
      { tipo: "ferias", valor: (base * 4) / 3 / 12 },
      { tipo: "fgts", valor: base * 0.08 },
      { tipo: "inss_patronal", valor: base * 0.2 },
    ];
    for (const t of tipos) {
      const { data: ant, error: antErr } = await supabase
        .from("folha_provisoes")
        .select("saldo_acumulado")
        .eq("contrato_id", i.contrato_id)
        .eq("tipo", t.tipo)
        .is("baixada_em", null)
        .order("competencia", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (antErr) throw antErr;
      const { error: insErr } = await supabase.from("folha_provisoes").insert({
        contrato_id: i.contrato_id,
        competencia,
        tipo: t.tipo,
        valor_mes: Math.round(t.valor * 100) / 100,
        saldo_acumulado: Math.round(((ant?.saldo_acumulado ?? 0) + t.valor) * 100) / 100,
      });
      if (insErr) throw insErr;
    }
  }
}
