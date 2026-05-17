type Props = {
  label: string;
  percent: number;
  centerLabel: string;
  centerValue: string;
  variant?: "default" | "warning" | "danger" | "success";
};

const VARIANT: Record<NonNullable<Props["variant"]>, { ring: string; bg: string; text: string }> = {
  default: { ring: "text-brand",   bg: "from-brand/10 to-transparent",   text: "text-brand" },
  warning: { ring: "text-warning", bg: "from-warning/10 to-transparent", text: "text-warning" },
  danger:  { ring: "text-danger",  bg: "from-danger/15 to-transparent",  text: "text-danger" },
  success: { ring: "text-success", bg: "from-success/10 to-transparent", text: "text-success" },
};

export function MetricRing({ label, percent, centerLabel, centerValue, variant = "default" }: Props) {
  const size = 124;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(percent, 0), 1);
  const filled = circ * pct;
  const v = VARIANT[variant];

  return (
    <article className={`relative overflow-hidden rounded-panel bg-surface bg-gradient-to-br ${v.bg} p-6 shadow-soft`}>
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">{label}</p>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative">
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
              className={v.ring}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <strong className={`text-xl font-bold ${v.text}`}>{(pct * 100).toFixed(0)}%</strong>
          </div>
        </div>
        <div>
          <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55">{centerLabel}</p>
          <strong className="block text-2xl font-bold text-ink">{centerValue}</strong>
        </div>
      </div>
    </article>
  );
}
