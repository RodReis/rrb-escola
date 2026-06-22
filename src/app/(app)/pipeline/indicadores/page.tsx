import { requirePermission } from "@/lib/auth/session";
import { getIndicadoresPipeline } from "@/lib/actions/pipeline-indicadores";
import { IndicadoresDashboard } from "@/components/pipeline/indicadores-dashboard";

type SearchParams = { periodo?: string };

export default async function PipelineIndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission("pipeline", "read");

  const params = await searchParams;
  const rawPeriodo = Number(params.periodo ?? "30");
  const periodo = ([30, 90, 180] as const).includes(rawPeriodo as 30 | 90 | 180)
    ? (rawPeriodo as 30 | 90 | 180)
    : 30;

  const resultado = await getIndicadoresPipeline(periodo);
  const dados = resultado.ok ? resultado.data : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[rgb(var(--color-ink))]">
          Indicadores de Captação
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-ink)/0.55)]">
          Métricas do pipeline — últimos {periodo} dias.
        </p>
      </div>

      {!dados && resultado.ok === false && (
        <p className="text-sm text-[rgb(var(--color-danger))]">{resultado.error}</p>
      )}

      {dados && <IndicadoresDashboard dados={dados} periodoAtual={periodo} />}
    </div>
  );
}
