import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processarLote } from "@/lib/comunicados/processar";
import { processarLembretes } from "@/lib/lembretes/processar";
import {
  jobGerarFolha,
  jobAlertasFolha,
  jobGerarDecimo,
  jobGerarFerias,
  jobAlertasAquisitivo,
} from "@/lib/actions/folha-jobs";
import { jobPipelineAutomacoes } from "@/lib/actions/pipeline-jobs";
import { syncExtratoSicoob } from "@/lib/conciliacao/sync-extrato";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  let hoje = new Date();
  if (process.env.NODE_ENV !== "production") {
    const url = new URL(req.url);
    const hojeParam = url.searchParams.get("hoje");
    if (hojeParam) hoje = new Date(`${hojeParam}T12:00:00Z`);
  }

  const jobs: Array<[string, () => Promise<unknown>]> = [
    ["comunicados", () => processarLote()],
    ["lembretes", () => processarLembretes({ forcarReenvio: false })],
    ["folha_gerar", () => jobGerarFolha(hoje)],
    ["folha_alertas", () => jobAlertasFolha(hoje)],
    ["folha_decimo", () => jobGerarDecimo(hoje)],
    ["folha_ferias", () => jobGerarFerias(hoje)],
    ["folha_aquisitivos", () => jobAlertasAquisitivo(hoje)],
    ["pipeline_automacoes", () => jobPipelineAutomacoes(hoje)],
    ["sicoob_extrato", () => syncExtratoSicoob()],
  ];

  const resultados: Record<string, unknown> = {};

  for (const [nome, fn] of jobs) {
    try {
      resultados[nome] = await fn();
      await supabase.from("jobs_log").insert({ job: nome, sucesso: true, detalhe: resultados[nome] });
    } catch (e) {
      resultados[nome] = { erro: String(e) };
      await supabase.from("jobs_log").insert({ job: nome, sucesso: false, detalhe: { erro: String(e) } });
    }
  }

  return NextResponse.json(resultados);
}
