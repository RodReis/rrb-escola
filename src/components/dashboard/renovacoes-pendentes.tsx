import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { RenovacaoRow } from "@/lib/data/dashboard-executive";

export function RenovacoesPendentes({ items }: { items: RenovacaoRow[] }) {
  const sorted = [...items].sort((a, b) => a.diasRestantes - b.diasRestantes);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-warning/10 text-warning">
            <CalendarClock size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Renovações pendentes</h3>
            <p className="text-[0.66rem] text-ink/55">próximos vencimentos de matrícula</p>
          </div>
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/40">
          <CalendarClock size={24} />
          <p className="text-sm">Nenhuma matrícula ativa no ano corrente.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-2">
          {sorted.map((r, i) => {
            const urgente = r.diasRestantes < 60;
            return (
              <li key={r.matriculaId}>
                <Link
                  href={`/alunos/${r.alunoId}`}
                  className="flex items-center gap-3 rounded-ui border border-line p-3 transition hover:bg-muted/40"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-warning/10 text-xs font-bold text-warning">
                    {i + 1}
                  </span>
                  <Avatar name={r.alunoNome} src={r.fotoUrl} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{r.alunoNome}</p>
                    <p className="text-xs text-ink/55">Ano letivo {r.anoLetivo}</p>
                  </div>
                  <span className={`shrink-0 rounded-pill px-2 py-1 text-sm font-bold ${urgente ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                    {r.diasRestantes}d
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
