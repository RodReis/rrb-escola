type Props = {
  label: string;
  percent: number;
  centerLabel: string;
  centerValue: string;
  variant?: "default" | "warning" | "danger";
};

export function MetricRing({ label, percent, centerLabel, centerValue, variant = "default" }: Props) {
  const size = 120;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const filled = circ * Math.min(Math.max(percent, 0), 1);
  const colorClass =
    variant === "danger" ? "text-danger" :
    variant === "warning" ? "text-warning" :
    "text-brand";

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">{label}</p>
      <div className="mt-4 flex items-center gap-4">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ - filled}`}
            className={colorClass}
          />
        </svg>
        <div>
          <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55">{centerLabel}</p>
          <strong className="block text-2xl font-bold text-ink">{centerValue}</strong>
        </div>
      </div>
    </article>
  );
}
