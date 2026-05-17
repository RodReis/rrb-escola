import { DollarSign, Receipt, Users, TrendingUp } from "lucide-react";
import { money } from "@/lib/constants";
import { DeltaBadge } from "./delta-badge";
import type { HeroData } from "@/lib/data/dashboard-executive";

type CardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  previous: number;
  invert?: boolean;
  highlight?: boolean;
};

function HeroCard({ icon, label, value, previous, invert, highlight }: CardProps) {
  const bg = highlight ? "bg-brand text-paper" : "bg-surface text-ink";
  const labelColor = highlight ? "text-paper/70" : "text-ink/55";
  return (
    <article className={`rounded-panel ${bg} p-6 shadow-soft`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-ui ${highlight ? "bg-paper/15" : "bg-muted text-brand"}`}>
          {icon}
        </span>
        <p className={`text-[0.66rem] font-bold uppercase tracking-kicker ${labelColor}`}>{label}</p>
      </div>
      <strong className="mt-3 block text-3xl font-bold">{money.format(value)}</strong>
      <div className="mt-2">
        <DeltaBadge current={value} previous={previous} invert={invert} />
      </div>
    </article>
  );
}

export function HeroFinancial({ data }: { data: HeroData }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <HeroCard icon={<DollarSign size={16} />} label="Receita" value={data.receita} previous={data.receitaPrev} />
      <HeroCard icon={<Receipt size={16} />} label="Despesas" value={data.despesa} previous={data.despesaPrev} invert />
      <HeroCard icon={<Users size={16} />} label="Folha" value={data.folha} previous={data.folhaPrev} invert />
      <HeroCard icon={<TrendingUp size={16} />} label="Margem" value={data.margem} previous={data.margemPrev} highlight />
    </section>
  );
}
