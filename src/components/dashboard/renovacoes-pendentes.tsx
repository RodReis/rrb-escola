import { CalendarClock } from "lucide-react";
import type { RenovacaoRow } from "@/lib/data/dashboard-executive";

export function RenovacoesPendentes({ items }: { items: RenovacaoRow[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-warning/10 text-warning">
          <CalendarClock size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Renovações pendentes</p>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Nenhuma matrícula ativa no ano corrente.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {items.map((r, i) => {
            const urgente = r.diasRestantes < 60;
            return (
              <li key={r.matriculaId} className="flex items-center justify-between gap-3 rounded-ui border border-line p-3 hover:bg-muted/60">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-warning/10 text-xs font-bold text-warning">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{r.alunoNome}</p>
                    <p className="text-xs text-ink/55">Ano letivo {r.anoLetivo}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-pill px-2 py-1 text-sm font-bold ${urgente ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                  {r.diasRestantes}d
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
