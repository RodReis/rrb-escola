import { Receipt } from "lucide-react";
import { money } from "@/lib/constants";
import type { DevedorRow } from "@/lib/data/dashboard-executive";

export function TopDevedores({ items }: { items: DevedorRow[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-danger/10 text-danger">
          <Receipt size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Top devedores</p>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Sem inadimplência registrada.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {items.map((d, i) => (
            <li key={d.alunoId} className="flex items-center justify-between gap-3 rounded-ui border border-line p-3 hover:bg-muted/60">
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-danger/10 text-xs font-bold text-danger">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{d.nome}</p>
                  <p className="text-xs text-ink/55">{d.diasVencimento} dias em atraso</p>
                </div>
              </div>
              <span className="shrink-0 rounded-pill bg-danger/10 px-2 py-1 text-sm font-bold text-danger">{money.format(d.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
