import Link from "next/link";
import { AlertCircle, AlertTriangle, BellRing, ChevronRight, Info } from "lucide-react";
import type { AlertaItem } from "@/lib/data/dashboard-executive";

const ICONS = {
  critico: AlertCircle,
  atencao: AlertTriangle,
  info: Info,
};

const STYLES = {
  critico: { chip: "text-danger bg-danger/15", row: "border-danger/20 bg-danger/5 hover:bg-danger/10" },
  atencao: { chip: "text-warning bg-warning/15", row: "border-warning/20 bg-warning/5 hover:bg-warning/10" },
  info:    { chip: "text-brand bg-brand/15", row: "border-brand/20 bg-brand/5 hover:bg-brand/10" },
};

export function AlertList({ items }: { items: AlertaItem[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-warning/10 text-warning">
          <BellRing size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Alertas</p>
        {items.length > 0 && (
          <span className="ml-auto inline-flex items-center justify-center rounded-pill bg-danger/10 px-2 py-0.5 text-[0.66rem] font-bold text-danger">
            {items.length}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Tudo certo. Sem alertas no momento.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {items.map((a) => {
            const Icon = ICONS[a.severidade];
            const s = STYLES[a.severidade];
            const content = (
              <div className={`flex items-start gap-3 rounded-ui border p-3 transition-colors ${s.row}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-ui ${s.chip}`}>
                  <Icon size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">{a.titulo}</p>
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
      )}
    </article>
  );
}
