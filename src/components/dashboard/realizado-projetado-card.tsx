import { Target } from "lucide-react";
import { money } from "@/lib/constants";
import type { RealizadoVsProjetadoData } from "@/lib/data/dashboard-executive";

const SEG_LABEL: Record<string, string> = {
  INFANTIL: "Ed. Infantil",
  FUNDAMENTAL1: "Fund. I",
  FUNDAMENTAL2: "Fund. II",
  MEDIO: "Médio",
};

const SEG_COLOR: Record<string, string> = {
  INFANTIL: "bg-gold",
  FUNDAMENTAL1: "bg-brand",
  FUNDAMENTAL2: "bg-clay",
  MEDIO: "bg-moss",
};

export function RealizadoProjetadoCard({ data }: { data: RealizadoVsProjetadoData }) {
  const pct = data.pctRealizacao * 100;
  const gap = data.diferenca;
  const gapClass = gap >= 0 ? "text-success" : "text-danger";
  const pctVisual = Math.min(Math.max(pct, 0), 100);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
            <Target size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Realizado vs Projetado</h3>
            <p className="text-[0.66rem] text-ink/60">por etapa de ensino</p>
          </div>
        </div>
        <div className="text-right">
          <strong className={`block text-2xl font-bold leading-none ${pct >= 95 ? "text-success" : pct >= 80 ? "text-warning" : "text-danger"}`}>
            {pct.toFixed(1)}%
          </strong>
          <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/60">taxa de realização</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.66rem] uppercase tracking-kicker text-ink/60">Projetado</p>
          <strong className="mt-1 block text-xl font-bold text-ink">{money.format(data.projetado)}</strong>
        </div>
        <div className="rounded-ui bg-brand/10 p-3">
          <p className="text-[0.66rem] uppercase tracking-kicker text-brand/80">Realizado</p>
          <strong className="mt-1 block text-xl font-bold text-brand">{money.format(data.realizado)}</strong>
        </div>
        <div className={`rounded-ui p-3 ${gap >= 0 ? "bg-success/10" : "bg-danger/10"}`}>
          <p className={`text-[0.66rem] uppercase tracking-kicker ${gap >= 0 ? "text-success/80" : "text-danger/80"}`}>
            {gap >= 0 ? "Excedente" : "Gap"}
          </p>
          <strong className={`mt-1 block text-xl font-bold ${gapClass}`}>
            {money.format(Math.abs(gap))}
          </strong>
        </div>
      </div>

      <div className="mt-4 h-2 w-full rounded-pill bg-muted overflow-hidden">
        <div
          className={`h-2 rounded-pill ${pct >= 95 ? "bg-success" : pct >= 80 ? "bg-warning" : "bg-danger"} transition-all`}
          style={{ width: `${pctVisual}%` }}
        />
      </div>

      <div className="mt-6 grid gap-2">
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">Por etapa</p>
        {data.porEtapa.map((e) => {
          const pctEtapa = e.projetado > 0 ? (e.realizado / e.projetado) * 100 : 0;
          const dotColor = SEG_COLOR[e.etapa] ?? "bg-ink/30";
          return (
            <div key={e.etapa} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                  <span className="text-sm font-semibold text-ink truncate">{SEG_LABEL[e.etapa] ?? e.etapa}</span>
                  <span className="text-xs text-ink/60">{e.matriculados} × {money.format(e.valorReferencia)}</span>
                </div>
                <span className={`shrink-0 text-xs font-bold ${e.diferenca >= 0 ? "text-success" : "text-danger"}`}>
                  {e.diferenca >= 0 ? "+" : ""}{money.format(e.diferenca)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-pill bg-muted overflow-hidden">
                  <div className={`h-1.5 ${dotColor}`} style={{ width: `${Math.min(pctEtapa, 100)}%` }} />
                </div>
                <span className="shrink-0 text-[0.66rem] font-semibold text-ink/60 w-12 text-right">
                  {pctEtapa.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
