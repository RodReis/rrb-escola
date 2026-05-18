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

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-danger/10 text-danger">
          <Layers size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Top categorias de despesa
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Sem despesas neste mês.</p>
      ) : (
        <>
          <strong className="mt-3 block text-2xl font-bold text-ink">{money.format(total)}</strong>
          <p className="text-xs text-ink/55">total de {items.reduce((s, r) => s + r.count, 0)} despesas</p>

          <ul className="mt-4 grid gap-3">
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
                    <span className="shrink-0 text-[0.66rem] font-semibold text-ink/55">{pct.toFixed(1)}%</span>
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
