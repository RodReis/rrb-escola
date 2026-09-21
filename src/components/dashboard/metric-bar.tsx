import { PieChart } from "lucide-react";

type Props = {
  label: string;
  percent: number;
  caption: string;
  thresholds?: { warning: number; danger: number };
};

export function MetricBar({
  label,
  percent,
  caption,
  thresholds = { warning: 0.5, danger: 0.65 },
}: Props) {
  const pct = Math.min(Math.max(percent, 0), 1);
  const status: "success" | "warning" | "danger" =
    pct >= thresholds.danger ? "danger" :
    pct >= thresholds.warning ? "warning" :
    "success";

  const cfg = {
    success: { bar: "bg-success", text: "text-success", grad: "from-success/10 to-transparent", chip: "bg-success/10 text-success" },
    warning: { bar: "bg-warning", text: "text-warning", grad: "from-warning/10 to-transparent", chip: "bg-warning/10 text-warning" },
    danger:  { bar: "bg-danger",  text: "text-danger",  grad: "from-danger/15 to-transparent",  chip: "bg-danger/10 text-danger" },
  }[status];

  const statusLabel = status === "success" ? "Saudável" : status === "warning" ? "Atenção" : "Crítico";

  return (
    <article className={`rounded-panel bg-surface bg-gradient-to-br ${cfg.grad} p-6 shadow-soft`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-ui ${cfg.chip}`}>
          <PieChart size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">{label}</p>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <strong className={`text-3xl font-bold ${cfg.text}`}>{(pct * 100).toFixed(1)}%</strong>
        <span className={`rounded-pill px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-kicker ${cfg.chip}`}>{statusLabel}</span>
      </div>
      <div className="mt-3 h-2.5 w-full rounded-pill bg-muted overflow-hidden">
        <div className={`h-2.5 rounded-pill ${cfg.bar} transition-all`} style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mt-2 text-sm text-ink/60">{caption}</p>
    </article>
  );
}
