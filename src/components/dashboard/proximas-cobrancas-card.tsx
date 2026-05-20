import Link from "next/link";
import { CalendarClock, ArrowUpRight } from "lucide-react";
import { money } from "@/lib/constants";
import { Avatar } from "@/components/ui/avatar";
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-warning/10 text-warning">
            <CalendarClock size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Próximas cobranças</h3>
            <p className="text-[0.66rem] text-ink/55">próximos 7 dias</p>
          </div>
        </div>
        {items.length > 0 && (
          <div className="text-right">
            <strong className="block text-lg font-bold text-ink leading-none">{money.format(total)}</strong>
            <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/45">total</p>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/40">
          <CalendarClock size={24} />
          <p className="text-sm">Nenhuma cobrança nos próximos 7 dias.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-2">
          {items.map((c) => {
            const b = badgeDias(c.diasAteVencimento);
            return (
              <li key={c.cobrancaId}>
                <Link
                  href={c.alunoId ? `/alunos/${c.alunoId}` : "/financeiro"}
                  className="flex items-center gap-3 rounded-ui border border-line p-3 transition hover:bg-muted/40"
                >
                  <span className={`grid h-9 w-12 shrink-0 place-items-center rounded-pill text-[0.66rem] font-bold uppercase tracking-kicker ${b.cls}`}>
                    {b.text}
                  </span>
                  <Avatar name={c.alunoNome} src={c.fotoUrl} size={32} />
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
