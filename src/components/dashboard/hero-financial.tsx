import { DollarSign, Receipt, Users, TrendingUp, TrendingDown } from "lucide-react";
import { money } from "@/lib/constants";
import { DeltaBadge } from "./delta-badge";
import type { HeroData } from "@/lib/data/dashboard-executive";

type CardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  previous: number;
  invert?: boolean;
  tone?: "brand" | "danger" | "warning" | "margem";
};

const TONES: Record<NonNullable<CardProps["tone"]>, { bg: string; icon: string; ring: string }> = {
  brand:   { bg: "from-brand/15 via-surface to-surface",     icon: "bg-brand/15 text-brand",     ring: "ring-brand/10" },
  danger:  { bg: "from-danger/15 via-surface to-surface",    icon: "bg-danger/15 text-danger",   ring: "ring-danger/10" },
  warning: { bg: "from-warning/15 via-surface to-surface",   icon: "bg-warning/15 text-warning", ring: "ring-warning/10" },
  margem:  { bg: "from-success/25 via-success/10 to-surface", icon: "bg-success/20 text-success", ring: "ring-success/20" },
};

function HeroCard({ icon, label, value, previous, invert, tone = "brand" }: CardProps) {
  const t = TONES[tone];
  const negative = value < 0;
  return (
    <article className={`relative overflow-hidden rounded-panel bg-gradient-to-br ${t.bg} p-6 shadow-soft ring-1 ${t.ring}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-ui ${t.icon}`}>
          {icon}
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/70">{label}</p>
      </div>
      <strong className={`mt-4 block text-[2.1rem] font-bold leading-none ${negative ? "text-danger" : "text-ink"}`}>
        {money.format(value)}
      </strong>
      <div className="mt-3">
        <DeltaBadge current={value} previous={previous} invert={invert} />
      </div>
    </article>
  );
}

export function HeroFinancial({ data }: { data: HeroData }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <HeroCard icon={<DollarSign size={18} />} label="Receita" value={data.receita} previous={data.receitaPrev} tone="brand" />
      <HeroCard icon={<Receipt size={18} />} label="Despesas" value={data.despesa} previous={data.despesaPrev} invert tone="danger" />
      <HeroCard icon={<Users size={18} />} label="Folha" value={data.folha} previous={data.folhaPrev} invert tone="warning" />
      <HeroCard icon={data.margem >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Margem" value={data.margem} previous={data.margemPrev} tone="margem" />
    </section>
  );
}
