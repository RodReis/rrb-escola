import { TrendingDown, TrendingUp, Minus } from "lucide-react";

type Props = {
  current: number;
  previous: number;
  invert?: boolean;
};

export function DeltaBadge({ current, previous, invert = false }: Props) {
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-muted px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-kicker text-ink/60">
        <Minus size={12} /> sem base
      </span>
    );
  }

  const diff = (current - previous) / Math.abs(previous);
  const positive = diff >= 0;
  const good = invert ? !positive : positive;

  const Icon = diff === 0 ? Minus : positive ? TrendingUp : TrendingDown;
  const cls = good
    ? "bg-success/10 text-success"
    : "bg-danger/10 text-danger";

  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-kicker ${cls}`}>
      <Icon size={12} />
      {positive ? "+" : ""}{(diff * 100).toFixed(1)}%
    </span>
  );
}
