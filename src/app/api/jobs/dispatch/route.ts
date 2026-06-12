import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processarLote } from "@/lib/comunicados/processar";
import { processarLembretes } from "@/lib/lembretes/processar";
import { jobGerarFolha, jobAlertasFolha } from "@/lib/actions/folha-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const hoje = new Date();

  const jobs: Array<[string, () => Promise<unknown>]> = [
    ["comunicados", () => processarLote()],
    ["lembretes", () => processarLembretes({ forcarReenvio: false })],
    ["folha_gerar", () => jobGerarFolha(hoje)],
    ["folha_alertas", () => jobAlertasFolha(hoje)],
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
