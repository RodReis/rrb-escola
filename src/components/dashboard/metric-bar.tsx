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
  const color =
    pct >= thresholds.danger ? "bg-danger" :
    pct >= thresholds.warning ? "bg-warning" :
    "bg-success";

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">{label}</p>
      <strong className="mt-3 block text-3xl font-bold text-ink">
        {(pct * 100).toFixed(1)}%
      </strong>
      <div className="mt-3 h-2 w-full rounded-pill bg-muted">
        <div
          className={`h-2 rounded-pill ${color}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-ink/60">{caption}</p>
    </article>
  );
}
