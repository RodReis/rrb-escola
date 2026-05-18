import { DollarSign, Receipt, Users, TrendingUp, TrendingDown } from "lucide-react";
import { money } from "@/lib/constants";
import { DeltaBadge } from "./delta-badge";
import type { HeroData } from "@/lib/data/dashboard-executive";

type CardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  previous: number;
  yoy?: number;
  invert?: boolean;
  tone?: "brand" | "danger" | "warning" | "margem";
};

function yoyText(current: number, yoy: number | undefined, invert: boolean): { text: string; cls: string } | null {
  if (yoy === undefined || yoy === 0) return null;
  const diff = (current - yoy) / Math.abs(yoy);
  const positive = diff >= 0;
  const good = invert ? !positive : positive;
  const cls = good ? "text-success/80" : "text-danger/80";
  return { text: `${positive ? "+" : ""}${(diff * 100).toFixed(1)}% vs ano anterior`, cls };
}

const TONES: Record<NonNullable<CardProps["tone"]>, { bg: string; icon: string; ring: string }> = {
  brand:   { bg: "from-brand/15 via-surface to-surface",     icon: "bg-brand/15 text-brand",     ring: "ring-brand/10" },
  danger:  { bg: "from-danger/15 via-surface to-surface",    icon: "bg-danger/15 text-danger",   ring: "ring-danger/10" },
  warning: { bg: "from-warning/15 via-surface to-surface",   icon: "bg-warning/15 text-warning", ring: "ring-warning/10" },
  margem:  { bg: "from-success/25 via-success/10 to-surface", icon: "bg-success/20 text-success", ring: "ring-success/20" },
};

function HeroCard({ icon, label, value, previous, yoy, invert, tone = "brand" }: CardProps) {
  const t = TONES[tone];
  const negative = value < 0;
  const yoyInfo = yoyText(value, yoy, invert ?? false);
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
      {yoyInfo && (
        <p className={`mt-1.5 text-[0.66rem] font-semibold ${yoyInfo.cls}`}>{yoyInfo.text}</p>
      )}
    </article>
  );
}

type DespesasCardProps = {
  total: number;
  previous: number;
  yoy?: number;
  fixas: number;
  variaveis: number;
};

function DespesasCard({ total, previous, yoy, fixas, variaveis }: DespesasCardProps) {
  const t = TONES.danger;
  const fixasPct = total > 0 ? (fixas / total) * 100 : 0;
  const variaveisPct = total > 0 ? (variaveis / total) * 100 : 0;
  const yoyInfo = yoyText(total, yoy, true);

  return (
    <article className={`relative overflow-hidden rounded-panel bg-gradient-to-br ${t.bg} p-6 shadow-soft ring-1 ${t.ring}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-ui ${t.icon}`}>
          <Receipt size={18} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/70">Despesas</p>
      </div>
      <strong className="mt-4 block text-[2.1rem] font-bold leading-none text-ink">
        {money.format(total)}
      </strong>
      <div className="mt-3 flex items-center gap-2">
        <DeltaBadge current={total} previous={previous} invert />
      </div>
      {yoyInfo && (
        <p className={`mt-1.5 text-[0.66rem] font-semibold ${yoyInfo.cls}`}>{yoyInfo.text}</p>
      )}

      {total > 0 && (
        <>
          <div className="mt-4 flex h-2 w-full overflow-hidden rounded-pill bg-muted">
            {fixas > 0 && (
              <div className="h-2 bg-danger" style={{ width: `${fixasPct}%` }} title={`Fixas ${fixasPct.toFixed(0)}%`} />
            )}
            {variaveis > 0 && (
              <div className="h-2 bg-warning" style={{ width: `${variaveisPct}%` }} title={`Variáveis ${variaveisPct.toFixed(0)}%`} />
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-danger" />
              <dt className="text-ink/55">Fixas</dt>
              <dd className="ml-auto font-semibold text-ink">{money.format(fixas)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" />
              <dt className="text-ink/55">Variáveis</dt>
              <dd className="ml-auto font-semibold text-ink">{money.format(variaveis)}</dd>
            </div>
          </dl>
        </>
      )}
    </article>
  );
}

export function HeroFinancial({ data }: { data: HeroData }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <HeroCard icon={<DollarSign size={18} />} label="Receita" value={data.receita} previous={data.receitaPrev} yoy={data.receitaYoY} tone="brand" />
      <DespesasCard total={data.despesa} previous={data.despesaPrev} yoy={data.despesaYoY} fixas={data.despesaFixa} variaveis={data.despesaVariavel} />
      <HeroCard icon={<Users size={18} />} label="Folha" value={data.folha} previous={data.folhaPrev} yoy={data.folhaYoY} invert tone="warning" />
      <HeroCard icon={data.margem >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Margem" value={data.margem} previous={data.margemPrev} yoy={data.margemYoY} tone="margem" />
    </section>
  );
}
