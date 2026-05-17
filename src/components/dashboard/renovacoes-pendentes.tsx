import type { RenovacaoRow } from "@/lib/data/dashboard-executive";

export function RenovacoesPendentes({ items }: { items: RenovacaoRow[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Renovações pendentes</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Nenhuma matrícula ativa no ano corrente.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {items.map((r) => (
            <li key={r.matriculaId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{r.alunoNome}</p>
                <p className="text-xs text-ink/55">Ano letivo {r.anoLetivo}</p>
              </div>
              <span className="text-sm font-semibold text-warning">{r.diasRestantes}d</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
