import { TrendingUp, TrendingDown } from "lucide-react";
import { money } from "@/lib/constants";
import type { SaldoYTDData } from "@/lib/data/dashboard-executive";

export function SaldoYTDCard({ data }: { data: SaldoYTDData }) {
  const positivo = data.margem >= 0;
  const tone = positivo ? "success" : "danger";
  const cfg = {
    success: { text: "text-success", grad: "from-success/15 to-transparent", chip: "bg-success/15 text-success" },
    danger:  { text: "text-danger",  grad: "from-danger/15 to-transparent",  chip: "bg-danger/15 text-danger"  },
  }[tone];

  const Icon = positivo ? TrendingUp : TrendingDown;
  const custosTotal = data.despesa + data.folha;

  return (
    <article className={`rounded-panel bg-surface bg-gradient-to-br ${cfg.grad} p-6 shadow-soft`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-ui ${cfg.chip}`}>
          <Icon size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Saldo YTD ({data.mesesComputados}m)
        </p>
      </div>

      <strong className={`mt-3 block text-3xl font-bold ${cfg.text}`}>
        {money.format(data.margem)}
      </strong>
      <p className="text-xs text-ink/55">acumulado do ano</p>

      <dl className="mt-4 grid gap-1.5 text-xs">
        <div className="flex items-center justify-between rounded-ui bg-brand/10 px-2 py-1.5">
          <dt className="text-[0.66rem] uppercase tracking-kicker text-brand/80">Receita</dt>
          <dd className="font-bold text-brand whitespace-nowrap">{money.format(data.receita)}</dd>
        </div>
        <div className="flex items-center justify-between rounded-ui bg-danger/10 px-2 py-1.5">
          <dt className="text-[0.66rem] uppercase tracking-kicker text-danger/80">Despesas</dt>
          <dd className="font-bold text-danger whitespace-nowrap">{money.format(data.despesa)}</dd>
        </div>
        <div className="flex items-center justify-between rounded-ui bg-warning/10 px-2 py-1.5">
          <dt className="text-[0.66rem] uppercase tracking-kicker text-warning/80">Folha</dt>
          <dd className="font-bold text-warning whitespace-nowrap">{money.format(data.folha)}</dd>
        </div>
      </dl>

      {data.receita > 0 && (
        <p className="mt-3 text-xs text-ink/55">
          Custos = <strong className="text-ink/70">{((custosTotal / data.receita) * 100).toFixed(1)}%</strong> da receita
        </p>
      )}
    </article>
  );
}
