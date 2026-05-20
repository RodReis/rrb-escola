import Link from "next/link";
import { Activity, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import type { SaudeSistemaData } from "@/lib/data/dashboard-executive";

export function SaudeSistemaCard({ data }: { data: SaudeSistemaData }) {
  const pct = data.totalChecks > 0 ? (data.okCount / data.totalChecks) * 100 : 0;
  const status: "success" | "warning" | "danger" =
    pct === 100 ? "success" : pct >= 60 ? "warning" : "danger";
  const colorCfg = {
    success: { text: "text-success", bg: "bg-success/10", grad: "from-success/10 to-transparent" },
    warning: { text: "text-warning", bg: "bg-warning/10", grad: "from-warning/10 to-transparent" },
    danger: { text: "text-danger", bg: "bg-danger/15", grad: "from-danger/15 to-transparent" },
  }[status];

  return (
    <article className={`rounded-panel bg-surface bg-gradient-to-br ${colorCfg.grad} p-6 shadow-soft`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`grid h-9 w-9 place-items-center rounded-ui ${colorCfg.bg} ${colorCfg.text}`}>
            <Activity size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Saúde do sistema</h3>
            <p className="text-[0.66rem] text-ink/55">configurações pendentes</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[0.66rem] font-bold uppercase ${colorCfg.bg} ${colorCfg.text}`}>
          {data.okCount}/{data.totalChecks}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <strong className={`text-3xl font-bold leading-none ${colorCfg.text}`}>{pct.toFixed(0)}%</strong>
          <span className="text-[0.66rem] uppercase tracking-kicker text-ink/45">configurado</span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-pill bg-muted overflow-hidden">
          <div
            className={`h-1.5 ${status === "success" ? "bg-success" : status === "warning" ? "bg-warning" : "bg-danger"} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="mt-5 grid gap-2">
        {data.itens.map((i) => {
          const Icon = i.ok ? CheckCircle2 : AlertCircle;
          return (
            <li key={i.id}>
              <Link
                href={i.href}
                className="flex items-start gap-3 rounded-ui border border-line p-3 hover:bg-muted/40"
              >
                <Icon size={16} className={`shrink-0 mt-0.5 ${i.ok ? "text-success" : "text-warning"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{i.titulo}</p>
                  <p className="text-xs text-ink/60">{i.detalhe}</p>
                </div>
                <ArrowUpRight size={12} className="text-ink/40 shrink-0 mt-1" />
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
