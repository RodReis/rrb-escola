import { createAdminClient } from "@/lib/supabase/admin";
import { gerarRunAdmin } from "@/lib/folha/service";
import { gerarRunEspecial } from "@/lib/folha/runs-especiais";
import { marcarVencidos } from "@/lib/folha/aquisitivos";
import { nthDiaUtil } from "@/lib/folha/date-utils";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { logSeFalhou } from "@/lib/actions/assert-ok";

type GerarResult = { company_id: string; runId: string; criada: boolean };

export async function jobGerarFolha(hoje: Date): Promise<GerarResult[]> {
  const supabase = createAdminClient();
  const competencia = hoje.toISOString().slice(0, 7);
  const dia = hoje.getUTCDate();

  const { data: configs } = await supabase
    .from("folha_config")
    .select("company_id, escola_id, dia_fechamento, jobs");

  const resultados: GerarResult[] = [];

  for (const cfg of configs ?? []) {
    const jobs = cfg.jobs as { gerar_folha?: boolean; alertas?: boolean } | null;
    if (!jobs?.gerar_folha || cfg.dia_fechamento !== dia) continue;

    const r = await gerarRunAdmin(cfg.company_id as string, competencia, "cron");
    resultados.push({ company_id: cfg.company_id as string, ...r });

    if (r.criada) {
      // A folha já foi gerada: falha no aviso não pode abortar o cron nem
      // impedir as outras empresas da lista.
      logSeFalhou(await supabase.from("notificacoes").insert({
        escola_id: (cfg.escola_id as string) ?? DEFAULT_SCHOOL_ID,
        perfil_id: null,
        tipo: "folha",
        titulo: `Folha ${competencia} gerada`,
        descricao: "Folha iniciada aguardando andamento.",
        href: `/rh/folha-v2/${r.runId}`,
        severidade: "info",
      }), "notificação de folha gerada");
    }
  }

  return resultados;
}

type AlertaRun = { id: string; status: string; competencia: string; company_id: string };
type AlertaResult = { run_id: string; competencia: string; vencimento: string; status: string };

export async function jobAlertasFolha(hoje: Date): Promise<AlertaResult[]> {
  const supabase = createAdminClient();
  const competencia = hoje.toISOString().slice(0, 7);
  const hojeISO = hoje.toISOString().slice(0, 10);

  const { data: runs } = await supabase
    .from("folha_runs")
    .select("id, status, competencia, company_id")
    .eq("competencia", competencia)
    .in("status", ["iniciada", "em_andamento", "revisao", "aprovacao"]);

  if (!runs?.length) return [];

  const seen = new Set<string>();
  const companyIds: string[] = [];
  for (const r of runs) {
    const id = (r as AlertaRun).company_id;
    if (!seen.has(id)) { seen.add(id); companyIds.push(id); }
  }
  const { data: configs } = await supabase
    .from("folha_config")
    .select("company_id, escola_id, regra_pagamento, feriados_locais")
    .in("company_id", companyIds);

  const cfgMap = new Map(
    (configs ?? []).map((c) => [c.company_id as string, c])
  );

  const alertas: AlertaResult[] = [];

  for (const run of runs ?? []) {
    const r = run as AlertaRun;
    const cfg = cfgMap.get(r.company_id);
    if (!cfg) continue;

    const regra = cfg.regra_pagamento as { n?: number } | null;
    const n = regra?.n ?? 5;
    const feriados = (cfg.feriados_locais as string[] | null) ?? [];

    let vencimento: string;
    try {
      vencimento = nthDiaUtil(r.competencia, n, feriados);
    } catch {
      continue;
    }

    const diff = (new Date(vencimento).getTime() - new Date(hojeISO).getTime()) / 86400000;
    if (r.status !== "aprovado" && diff <= 2 && diff >= 0) {
      alertas.push({ run_id: r.id, competencia: r.competencia, vencimento, status: r.status });
    }
  }

  if (alertas.length) {
    const escolaId = configs?.[0]?.escola_id as string | undefined ?? DEFAULT_SCHOOL_ID;

    const { data: existentes, error: existErr } = await supabase
      .from("notificacoes")
      .select("descricao")
      .eq("escola_id", escolaId)
      .eq("tipo", "folha")
      .eq("href", "/rh/folha-v2")
      .eq("severidade", "atencao")
      .gte("criada_em", `${hojeISO}T00:00:00Z`)
      .lte("criada_em", `${hojeISO}T23:59:59Z`);
    if (existErr) throw existErr;

    const jaAlertadas = new Set((existentes ?? []).map((n) => n.descricao as string));

    const novas = alertas
      .map((a) => ({
        escola_id: escolaId,
        perfil_id: null,
        tipo: "folha",
        titulo: "Alerta de folha",
        descricao: `Folha ${a.competencia} ainda ${a.status}; pagamento em ${a.vencimento}`,
        href: "/rh/folha-v2",
        severidade: "atencao" as const,
      }))
      .filter((n) => !jaAlertadas.has(n.descricao));

    if (novas.length) {
      const { error: insErr } = await supabase.from("notificacoes").insert(novas);
      if (insErr) throw insErr;
    }
  }

  return alertas;
}

type DecimoResult = { tipo: string; runId: string | null; criada: boolean; motivo?: string };

export async function jobGerarDecimo(hoje: Date): Promise<DecimoResult[]> {
  const supabase = createAdminClient();
  const hojeMMDD = hoje.toISOString().slice(5, 10);
  const competencia = hoje.toISOString().slice(0, 7);

  const { data: configs } = await supabase
    .from("folha_config")
    .select("company_id, escola_id, decimo_gerar_dia, jobs");

  const resultados: DecimoResult[] = [];

  for (const cfg of configs ?? []) {
    const jobs = cfg.jobs as { gerar_especiais?: boolean } | null;
    if (!jobs?.gerar_especiais) continue;

    const diaMap = cfg.decimo_gerar_dia as { decimo_1a?: string; decimo_2a?: string } | null;

    for (const tipo of ["decimo_1a", "decimo_2a"] as const) {
      if (diaMap?.[tipo] !== hojeMMDD) continue;
      const r = await gerarRunEspecial(cfg.company_id as string, competencia, tipo, "cron", undefined, supabase);
      resultados.push({ tipo, ...r });
    }
  }

  return resultados;
}

type FeriasResult = { janela: string; runId: string | null; criada: boolean; motivo?: string };

export async function jobGerarFerias(hoje: Date): Promise<FeriasResult[]> {
  const supabase = createAdminClient();

  const { data: configs } = await supabase
    .from("folha_config")
    .select("company_id, escola_id, ferias_janelas, ferias_gerar_antes_dias, jobs");

  const resultados: FeriasResult[] = [];

  for (const cfg of configs ?? []) {
    const jobs = cfg.jobs as { gerar_especiais?: boolean } | null;
    if (!jobs?.gerar_especiais) continue;

    const janelas = (cfg.ferias_janelas as Array<{ codigo: string; mes_gozo: number }> | null) ?? [];
    const antecipaDias = (cfg.ferias_gerar_antes_dias as number | null) ?? 30;

    for (const janela of janelas) {
      const alvo = new Date(hoje);
      alvo.setUTCDate(alvo.getUTCDate() + antecipaDias);
      if (alvo.getUTCMonth() + 1 !== janela.mes_gozo || hoje.getUTCDate() !== 1) continue;

      const competencia = hoje.toISOString().slice(0, 7);
      const r = await gerarRunEspecial(cfg.company_id as string, competencia, "ferias", "cron", janela.codigo, supabase);
      resultados.push({ janela: janela.codigo, ...r });
    }
  }

  return resultados;
}

type AquisitivoResult = { vencidosNovos: number; alertas: number };

export async function jobAlertasAquisitivo(hoje: Date): Promise<AquisitivoResult> {
  const supabase = createAdminClient();
  const hojeISO = hoje.toISOString().slice(0, 10);

  const vencidosNovos = await marcarVencidos(hojeISO, supabase);

  const { data: configs } = await supabase
    .from("folha_config")
    .select("alerta_aquisitivo_dias");

  const marcos: number[] = (configs?.[0]?.alerta_aquisitivo_dias as number[] | null) ?? [60, 30];

  type PeriodoRow = {
    id: string;
    fim: string;
    status: string;
    folha_contratos: { escola_id: string; employees: { name: string } | null } | null;
  };

  const { data: periodos, error: pErr } = await supabase
    .from("folha_periodos_aquisitivos")
    .select("id, fim, status, folha_contratos(escola_id, employees(name))")
    .in("status", ["aberto", "vencido"]);
  if (pErr) throw pErr;

  const novas: Array<{
    escola_id: string;
    perfil_id: null;
    tipo: string;
    descricao: string;
    href: string;
    severidade: "info" | "atencao";
  }> = [];

  for (const p of (periodos ?? []) as unknown as PeriodoRow[]) {
    const escolaId = p.folha_contratos?.escola_id ?? DEFAULT_SCHOOL_ID;
    const nome = p.folha_contratos?.employees?.name ?? "Funcionário";

    if (p.status === "vencido") {
      novas.push({
        escola_id: escolaId,
        perfil_id: null,
        tipo: "folha",
        descricao: `Férias vencidas (pagto em dobro): ${nome}`,
        href: "/rh/folha-v2/ferias",
        severidade: "atencao",
      });
      continue;
    }

    const limite = new Date(`${p.fim}T12:00:00Z`);
    limite.setUTCMonth(limite.getUTCMonth() + 11);
    const dias = Math.floor((limite.getTime() - new Date(`${hojeISO}T12:00:00Z`).getTime()) / 86400000);

    if (marcos.includes(dias)) {
      novas.push({
        escola_id: escolaId,
        perfil_id: null,
        tipo: "folha",
        descricao: `Férias de ${nome} vencem em ${dias} dias sem agendamento`,
        href: "/rh/folha-v2/ferias",
        severidade: dias <= 30 ? "atencao" : "info",
      });
    }
  }

  if (novas.length) {
    const { data: existentes } = await supabase
      .from("notificacoes")
      .select("descricao")
      .eq("tipo", "folha")
      .eq("href", "/rh/folha-v2/ferias")
      .gte("criada_em", `${hojeISO}T00:00:00Z`)
      .lte("criada_em", `${hojeISO}T23:59:59Z`);

    const jaAlertadas = new Set((existentes ?? []).map((n) => n.descricao as string));
    const deduplicadas = novas.filter((n) => !jaAlertadas.has(n.descricao));

    if (deduplicadas.length) {
      const { error: insErr } = await supabase.from("notificacoes").insert(deduplicadas);
      if (insErr) throw insErr;
    }
  }

  return { vencidosNovos, alertas: novas.length };
}
