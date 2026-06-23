import Link from "next/link";
import { GitBranch, ArrowUpRight, AlertTriangle } from "lucide-react";
import type { IndicadoresPipeline } from "@/lib/actions/pipeline-indicadores";
import type { StatusLead } from "@/lib/validation/pipeline";

const STATUS_LABEL: Record<StatusLead, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  reserva: "Reserva",
  convertido: "Convertido",
  perdido: "Perdido",
};

const STATUS_COR: Record<StatusLead, string> = {
  novo: "rgb(var(--color-brand))",
  em_analise: "var(--c-amber)",
  reserva: "var(--c-coral)",
  convertido: "var(--c-green)",
  perdido: "rgb(var(--color-ink) / 0.35)",
};

type Props = {
  data: IndicadoresPipeline;
};

export function PipelineStatusCard({ data }: Props) {
  const totalLeads = data.por_status.reduce((acc, s) => acc + s.total, 0);
  const maxStatus = Math.max(1, ...data.por_status.map((s) => s.total));

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
            <GitBranch size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Pipeline — Status &amp; Conversão</h3>
            <p className="text-[0.66rem] text-ink/55">últimos 30 dias</p>
          </div>
        </div>
        <Link
          href="/pipeline/indicadores"
          className="text-ink/40 hover:text-ink/70"
          aria-label="Ver indicadores do pipeline"
        >
          <ArrowUpRight size={14} />
        </Link>
      </div>

      {totalLeads === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/40 py-10 text-ink/40">
          <GitBranch size={24} />
          <p className="text-sm text-center px-3">Nenhum lead nos últimos 30 dias.</p>
        </div>
      ) : (
        <>
          {/* Funil por status */}
          <ul className="mt-4 grid gap-2">
            {data.por_status.map((s) => (
              <li key={s.status} className="flex items-center gap-2 text-xs">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: STATUS_COR[s.status] }}
                />
                <span className="w-24 shrink-0 truncate text-ink/70">
                  {STATUS_LABEL[s.status]}
                </span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${(s.total / maxStatus) * 100}%`,
                      background: STATUS_COR[s.status],
                    }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right font-bold tabular-nums text-ink">
                  {s.total}
                </span>
              </li>
            ))}
          </ul>

          {/* Conversão */}
          <div className="mt-5 flex items-baseline gap-2">
            <strong className="text-4xl font-bold leading-none text-green">
              {data.conversao.taxa_pct.toFixed(1)}%
            </strong>
            <span className="text-xs text-ink/55">taxa de conversão</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-ui bg-muted/40 p-2">
              <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Matrículas</dt>
              <dd className="mt-1 font-bold text-green">{data.conversao.matriculas}</dd>
            </div>
            <div className="rounded-ui bg-muted/40 p-2">
              <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Reservas</dt>
              <dd className="mt-1 font-bold text-ink">{data.conversao.reservas}</dd>
            </div>
          </dl>

          {/* Cards parados */}
          {data.parados.total > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-ui border border-danger/20 bg-danger/5 p-3">
              <AlertTriangle size={12} className="text-danger" />
              <p className="text-[0.7rem] text-danger">
                <strong>{data.parados.total}</strong> card{data.parados.total !== 1 ? "s" : ""} parado
                {data.parados.total !== 1 ? "s" : ""} além do prazo
              </p>
            </div>
          )}
        </>
      )}
    </article>
  );
}
