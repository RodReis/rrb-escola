import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { money } from "@/lib/constants";
import type { MargemTrendPoint } from "@/lib/data/dashboard-executive";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function labelMes(c: string): string {
  const [, m] = c.split("-").map(Number);
  return MESES[(m as number) - 1] ?? c;
}

export function MargemTrendCard({ data }: { data: MargemTrendPoint[] }) {
  if (data.length === 0) {
    return (
      <article className="rounded-panel bg-surface p-6 shadow-soft">
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Margem 6m</p>
        <p className="mt-4 text-sm text-ink/60">Sem dados.</p>
      </article>
    );
  }

  const margens = data.map((p) => p.margem);
  const max = Math.max(...margens, 0);
  const min = Math.min(...margens, 0);
  const span = max - min || 1;

  const ultima = margens[margens.length - 1] ?? 0;
  const penultima = margens.length > 1 ? margens[margens.length - 2] : 0;
  const delta = penultima !== 0 ? ((ultima - penultima) / Math.abs(penultima)) * 100 : 0;

  const positiva = ultima >= 0;
  const subiu = delta > 0;

  const w = 280;
  const h = 80;
  const padTop = 4;
  const padBot = 4;
  const usableH = h - padTop - padBot;

  // linha zero
  const zeroY = padTop + ((max - 0) / span) * usableH;

  const points = data.map((p, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = padTop + ((max - p.margem) / span) * usableH;
    return { x, y, margem: p.margem };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${polyline} ${w},${h}`;

  const StatusIcon = ultima === 0 ? Minus : positiva ? TrendingUp : TrendingDown;
  const colorClass = positiva ? "text-success" : "text-danger";
  const fillClass = positiva ? "fill-success/15" : "fill-danger/15";
  const strokeClass = positiva ? "stroke-success" : "stroke-danger";

  return (
    <article className={`rounded-panel bg-surface bg-gradient-to-br ${positiva ? "from-success/10" : "from-danger/10"} to-transparent p-6 shadow-soft`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-ui ${positiva ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
          <StatusIcon size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Margem 6 meses</p>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <strong className={`text-2xl font-bold ${colorClass}`}>{money.format(ultima)}</strong>
        {penultima !== 0 && (
          <span className={`rounded-pill px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-kicker ${
            subiu ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}>
            {subiu ? "+" : ""}{delta.toFixed(1)}%
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" preserveAspectRatio="none">
        <line x1={0} y1={zeroY} x2={w} y2={zeroY} className="stroke-ink/15" strokeWidth={0.5} strokeDasharray="2 2" />
        <polyline points={area} className={fillClass} stroke="none" />
        <polyline
          points={polyline}
          className={strokeClass}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} className={p.margem >= 0 ? "fill-success" : "fill-danger"} />
        ))}
      </svg>

      <div className="mt-2 flex justify-between text-[0.66rem] uppercase tracking-kicker text-ink/40">
        {data.map((p) => (
          <span key={p.competencia}>{labelMes(p.competencia)}</span>
        ))}
      </div>
    </article>
  );
}
