import Link from "next/link";
import { AlertCircle, AlertTriangle, ChevronRight, Info } from "lucide-react";
import type { AlertaItem } from "@/lib/data/dashboard-executive";

const ICONS = {
  critico: AlertCircle,
  atencao: AlertTriangle,
  info: Info,
};

const COLORS = {
  critico: "text-danger bg-danger/10",
  atencao: "text-warning bg-warning/10",
  info: "text-brand bg-brand/10",
};

export function AlertList({ items }: { items: AlertaItem[] }) {
  if (items.length === 0) {
    return (
      <article className="rounded-panel bg-surface p-6 shadow-soft">
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Alertas</p>
        <p className="mt-4 text-sm text-ink/60">Sem alertas no momento.</p>
      </article>
    );
  }

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Alertas</p>
      <ul className="mt-4 grid gap-3">
        {items.map((a) => {
          const Icon = ICONS[a.severidade];
          const content = (
            <div className="flex items-start gap-3 rounded-ui p-2 hover:bg-muted">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-ui ${COLORS[a.severidade]}`}>
                <Icon size={14} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{a.titulo}</p>
                <p className="text-xs text-ink/60">{a.descricao}</p>
              </div>
              {a.href && <ChevronRight size={14} className="mt-1 text-ink/40" />}
            </div>
          );
          return (
            <li key={a.id}>
              {a.href ? <Link href={a.href}>{content}</Link> : content}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
