import Link from "next/link";
import { CalendarClock, ArrowUpRight } from "lucide-react";
import { money } from "@/lib/constants";
import type { ProximaCobrancaRow } from "@/lib/data/dashboard-executive";

function badgeDias(dias: number): { text: string; cls: string } {
  if (dias === 0) return { text: "Hoje", cls: "bg-danger/15 text-danger" };
  if (dias === 1) return { text: "Amanhã", cls: "bg-warning/15 text-warning" };
  if (dias <= 3) return { text: `${dias}d`, cls: "bg-warning/10 text-warning" };
  return { text: `${dias}d`, cls: "bg-brand/10 text-brand" };
}

export function ProximasCobrancasCard({ items }: { items: ProximaCobrancaRow[] }) {
  const total = items.reduce((s, r) => s + r.valor, 0);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-warning/10 text-warning">
          <CalendarClock size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Próximas cobranças (7 dias)
        </p>
        <span className="ml-auto text-xs font-semibold text-ink/70">{money.format(total)}</span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Nenhuma cobrança nos próximos 7 dias.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {items.map((c) => {
            const b = badgeDias(c.diasAteVencimento);
            return (
              <li key={c.cobrancaId}>
                <Link
                  href={c.alunoId ? `/alunos/${c.alunoId}` : "/financeiro"}
                  className="flex items-center gap-3 rounded-ui border border-line p-3 hover:bg-muted/40"
                >
                  <span className={`grid h-9 w-12 shrink-0 place-items-center rounded-pill text-[0.66rem] font-bold uppercase tracking-kicker ${b.cls}`}>
                    {b.text}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.alunoNome}</p>
                    <p className="truncate text-xs text-ink/55">{c.descricao}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-ink">{money.format(c.valor)}</span>
                  <ArrowUpRight size={12} className="text-ink/40 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
