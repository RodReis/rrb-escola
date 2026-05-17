import { money } from "@/lib/constants";
import type { DevedorRow } from "@/lib/data/dashboard-executive";

export function TopDevedores({ items }: { items: DevedorRow[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Top devedores</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Sem inadimplência registrada.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {items.map((d) => (
            <li key={d.alunoId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{d.nome}</p>
                <p className="text-xs text-ink/55">{d.diasVencimento} dias em atraso</p>
              </div>
              <span className="text-sm font-bold text-danger">{money.format(d.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
