import { createAdminClient } from "@/lib/supabase/admin";
import { gerarRunAdmin } from "@/lib/folha/service";
import { nthDiaUtil } from "@/lib/folha/date-utils";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

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
      await supabase.from("notificacoes").insert({
        escola_id: (cfg.escola_id as string) ?? DEFAULT_SCHOOL_ID,
        perfil_id: null,
        tipo: "folha",
        titulo: `Folha ${competencia} gerada`,
        descricao: "Folha em rascunho aguardando revisão.",
        href: `/rh/folha-v2/${r.runId}`,
        severidade: "info",
      });
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
    .in("status", ["rascunho", "em_revisao", "aprovada"]);

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
    if (r.status !== "aprovada" && diff <= 2 && diff >= 0) {
      alertas.push({ run_id: r.id, competencia: r.competencia, vencimento, status: r.status });
    }
  }

  if (alertas.length) {
    const escolaId = configs?.[0]?.escola_id as string | undefined ?? DEFAULT_SCHOOL_ID;
    await supabase.from("notificacoes").insert(
      alertas.map((a) => ({
        escola_id: escolaId,
        perfil_id: null,
        tipo: "folha",
        titulo: "Alerta de folha",
        descricao: `Folha ${a.competencia} ainda ${a.status}; pagamento em ${a.vencimento}`,
        href: "/rh/folha-v2",
        severidade: "atencao" as const,
      }))
    );
  }

  return alertas;
}
