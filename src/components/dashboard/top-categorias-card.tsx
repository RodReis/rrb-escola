import { Layers } from "lucide-react";
import { money } from "@/lib/constants";
import type { CategoriaDespesaRow } from "@/lib/data/dashboard-executive";

const BAR_COLORS = [
  "bg-danger",
  "bg-clay",
  "bg-warning",
  "bg-gold",
  "bg-brand",
  "bg-accent",
];

export function TopCategoriasCard({ items }: { items: CategoriaDespesaRow[] }) {
  const total = items.reduce((s, r) => s + r.total, 0);

  const totalCount = items.reduce((s, r) => s + r.count, 0);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-danger/10 text-danger">
            <Layers size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Top categorias de despesa</h3>
            <p className="text-[0.66rem] text-ink/60">distribuição mensal</p>
          </div>
        </div>
        {items.length > 0 && (
          <div className="text-right">
            <strong className="block text-lg font-bold text-ink leading-none">{money.format(total)}</strong>
            <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/60">
              {totalCount} despesas
            </p>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/60">
          <Layers size={24} />
          <p className="text-sm">Sem despesas neste mês.</p>
        </div>
      ) : (
        <>
          <ul className="mt-5 grid gap-3">
            {items.map((r, i) => {
              const pct = total > 0 ? (r.total / total) * 100 : 0;
              const color = BAR_COLORS[i % BAR_COLORS.length];
              const tipoBadge =
                r.tipo === "fixa" ? "bg-brand/10 text-brand"
                : r.tipo === "mista" ? "bg-muted text-ink/60"
                : "bg-muted text-ink/60";
              const tipoLabel =
                r.tipo === "fixa" ? "Fixa"
                : r.tipo === "mista" ? "Mista"
                : "Variável";
              return (
                <li key={r.categoriaId ?? r.categoria}>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
                      <p className="truncate text-sm font-semibold text-ink">{r.categoria}</p>
                      <span className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase ${tipoBadge}`}>
                        {tipoLabel}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-ink">{money.format(r.total)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-pill bg-muted overflow-hidden">
                      <div className={`h-1.5 rounded-pill ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="shrink-0 text-[0.66rem] font-semibold text-ink/60">{pct.toFixed(1)}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </article>
  );
}
