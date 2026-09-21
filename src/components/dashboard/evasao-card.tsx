import { UserMinus, TrendingDown, Users } from "lucide-react";
import type { EvasaoData } from "@/lib/data/pedagogico";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function labelMes(c: string): string {
  const [, m] = c.split("-").map(Number);
  return MESES[(m as number) - 1] ?? c;
}

export function EvasaoCard({ data }: { data: EvasaoData }) {
  const pct = data.taxaEvasao * 100;
  const status: "success" | "warning" | "danger" =
    pct < 3 ? "success" : pct < 8 ? "warning" : "danger";

  const cfg = {
    success: { text: "text-success", grad: "from-success/10 to-transparent", chip: "bg-success/10 text-success" },
    warning: { text: "text-warning", grad: "from-warning/10 to-transparent", chip: "bg-warning/10 text-warning" },
    danger:  { text: "text-danger",  grad: "from-danger/15 to-transparent",  chip: "bg-danger/10 text-danger" },
  }[status];

  const totalEvasao = data.cancelados + data.transferidos;
  const totalGeral = data.ativos + totalEvasao + data.concluidos;
  const maxMes = Math.max(...data.porMes.map((m) => m.cancelados + m.transferidos), 1);

  return (
    <article className={`rounded-panel bg-surface bg-gradient-to-br ${cfg.grad} p-6 shadow-soft`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`grid h-9 w-9 place-items-center rounded-ui ${cfg.chip}`}>
              <UserMinus size={16} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink">Evasão</h3>
              <p className="text-[0.66rem] text-ink/60">ano corrente</p>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <strong className={`text-4xl font-bold leading-none ${cfg.text}`}>{pct.toFixed(1)}%</strong>
            <span className="text-xs text-ink/60">{totalEvasao} de {totalGeral}</span>
          </div>
        </div>
        <div className="rounded-ui bg-muted/40 px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1.5 text-ink/60">
            <Users size={11} />
            <span className="text-[0.6rem] font-semibold uppercase tracking-kicker">Ativos</span>
          </div>
          <strong className="mt-0.5 block text-2xl font-bold text-ink leading-none">{data.ativos}</strong>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-ui bg-danger/10 p-3">
          <dt className="text-[0.6rem] font-semibold uppercase tracking-kicker text-danger/80">Cancelados</dt>
          <dd className="mt-1 text-lg font-bold text-danger leading-none">{data.cancelados}</dd>
        </div>
        <div className="rounded-ui bg-warning/10 p-3">
          <dt className="text-[0.6rem] font-semibold uppercase tracking-kicker text-warning/80">Transferidos</dt>
          <dd className="mt-1 text-lg font-bold text-warning leading-none">{data.transferidos}</dd>
        </div>
        <div className="rounded-ui bg-success/10 p-3">
          <dt className="text-[0.6rem] font-semibold uppercase tracking-kicker text-success/80">Concluídos</dt>
          <dd className="mt-1 text-lg font-bold text-success leading-none">{data.concluidos}</dd>
        </div>
      </dl>

      {data.porMes.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={12} className="text-danger" />
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">Por mês</p>
            <span className="ml-auto flex items-center gap-3 text-[0.6rem] text-ink/60">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-danger" /> cancelados
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-warning" /> transferidos
              </span>
            </span>
          </div>
          <div className="grid gap-1.5">
            {data.porMes.map((m) => {
              const total = m.cancelados + m.transferidos;
              return (
                <div key={m.mes} className="flex items-center gap-2 text-xs">
                  <span className="w-10 shrink-0 font-semibold text-ink/60">{labelMes(m.mes)}</span>
                  <div className="flex-1 h-2.5 rounded-pill bg-muted overflow-hidden flex">
                    <div className="h-2.5 bg-danger transition-all" style={{ width: `${(m.cancelados / maxMes) * 100}%` }} />
                    <div className="h-2.5 bg-warning transition-all" style={{ width: `${(m.transferidos / maxMes) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right font-bold text-ink/70">{total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
