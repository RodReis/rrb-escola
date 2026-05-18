import { UserMinus, TrendingDown } from "lucide-react";
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
  const maxMes = Math.max(...data.porMes.map((m) => m.cancelados + m.transferidos), 1);

  return (
    <article className={`rounded-panel bg-surface bg-gradient-to-br ${cfg.grad} p-6 shadow-soft`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-ui ${cfg.chip}`}>
          <UserMinus size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Evasão (ano corrente)
        </p>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <strong className={`text-3xl font-bold ${cfg.text}`}>{pct.toFixed(1)}%</strong>
        <span className="text-xs text-ink/55">{totalEvasao} de {data.ativos + totalEvasao + data.concluidos}</span>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <div className="rounded-ui bg-muted/40 p-2">
          <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Ativos</dt>
          <dd className="mt-1 font-bold text-ink">{data.ativos}</dd>
        </div>
        <div className="rounded-ui bg-danger/10 p-2">
          <dt className="text-[0.66rem] uppercase tracking-kicker text-danger/80">Cancelados</dt>
          <dd className="mt-1 font-bold text-danger">{data.cancelados}</dd>
        </div>
        <div className="rounded-ui bg-warning/10 p-2">
          <dt className="text-[0.66rem] uppercase tracking-kicker text-warning/80">Transferidos</dt>
          <dd className="mt-1 font-bold text-warning">{data.transferidos}</dd>
        </div>
        <div className="rounded-ui bg-success/10 p-2">
          <dt className="text-[0.66rem] uppercase tracking-kicker text-success/80">Concluídos</dt>
          <dd className="mt-1 font-bold text-success">{data.concluidos}</dd>
        </div>
      </dl>

      {data.porMes.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={12} className="text-danger" />
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Por mês</p>
          </div>
          <div className="grid gap-1">
            {data.porMes.map((m) => {
              const total = m.cancelados + m.transferidos;
              const pctBar = (total / maxMes) * 100;
              return (
                <div key={m.mes} className="flex items-center gap-2 text-xs">
                  <span className="w-10 shrink-0 text-ink/55">{labelMes(m.mes)}</span>
                  <div className="flex-1 h-2 rounded-pill bg-muted overflow-hidden flex">
                    <div className="h-2 bg-danger" style={{ width: `${(m.cancelados / maxMes) * 100}%` }} />
                    <div className="h-2 bg-warning" style={{ width: `${(m.transferidos / maxMes) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right font-semibold text-ink/70">{total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
