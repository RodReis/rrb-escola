import { PieChart } from "lucide-react";
import { money } from "@/lib/constants";
import { DeltaBadge } from "./delta-badge";
import { TrendSpark } from "./trend-spark";
import type { FolhaRatioData } from "@/lib/data/dashboard-executive";

type Props = {
  data: FolhaRatioData;
  thresholds?: { warning: number; danger: number };
};

export function FolhaRatioCard({
  data,
  thresholds = { warning: 0.5, danger: 0.65 },
}: Props) {
  const pct = Math.min(Math.max(data.ratio, 0), 1);
  const status: "success" | "warning" | "danger" =
    pct >= thresholds.danger ? "danger" :
    pct >= thresholds.warning ? "warning" :
    "success";

  const cfg = {
    success: { bar: "bg-success", text: "text-success", grad: "from-success/10 to-transparent", chip: "bg-success/10 text-success", spark: "text-success" },
    warning: { bar: "bg-warning", text: "text-warning", grad: "from-warning/10 to-transparent", chip: "bg-warning/10 text-warning", spark: "text-warning" },
    danger:  { bar: "bg-danger",  text: "text-danger",  grad: "from-danger/15 to-transparent",  chip: "bg-danger/10 text-danger",  spark: "text-danger" },
  }[status];

  const statusLabel = status === "success" ? "Saudável" : status === "warning" ? "Atenção" : "Crítico";

  // serie em fracao -> percentuais para sparkline
  const serieVisual = data.serie.map((v) => v * 100);

  return (
    <article className={`rounded-panel bg-surface bg-gradient-to-br ${cfg.grad} p-6 shadow-soft`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`grid h-9 w-9 place-items-center rounded-ui ${cfg.chip}`}>
            <PieChart size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Folha / Receita</h3>
            <p className="text-[0.66rem] text-ink/60">indicador trabalhista</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker ${cfg.chip}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <strong className={`text-4xl font-bold leading-none ${cfg.text}`}>{(pct * 100).toFixed(1)}%</strong>
        <DeltaBadge current={data.ratio * 100} previous={data.ratioPrev * 100} invert />
      </div>

      <div className="mt-4 h-2.5 w-full rounded-pill bg-muted overflow-hidden">
        <div className={`h-2.5 rounded-pill ${cfg.bar} transition-all`} style={{ width: `${pct * 100}%` }} />
      </div>

      {serieVisual.length >= 2 && (
        <div className={`mt-3 flex items-center gap-2 ${cfg.spark}`}>
          <TrendSpark values={serieVisual} width={120} height={28} />
          <span className="text-[0.66rem] uppercase tracking-kicker text-ink/60">últ 6m</span>
        </div>
      )}

      <p className="mt-3 text-xs text-ink/60">
        {money.format(data.folha)} <span className="text-ink/30">/</span> {money.format(data.receita)}
      </p>
    </article>
  );
}
