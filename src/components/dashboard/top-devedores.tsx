import Link from "next/link";
import { Receipt } from "lucide-react";
import { money } from "@/lib/constants";
import { Avatar } from "@/components/ui/avatar";
import type { DevedorRow } from "@/lib/data/dashboard-executive";

export function TopDevedores({ items }: { items: DevedorRow[] }) {
  const total = items.reduce((s, r) => s + r.valor, 0);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-danger/10 text-danger">
            <Receipt size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Top devedores</h3>
            <p className="text-[0.66rem] text-ink/60">cobranças vencidas</p>
          </div>
        </div>
        {items.length > 0 && (
          <div className="text-right">
            <strong className="block text-lg font-bold text-danger leading-none">{money.format(total)}</strong>
            <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/60">
              em atraso
            </p>
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/60">
          <Receipt size={24} />
          <p className="text-sm">Sem inadimplência registrada.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-2">
          {items.map((d, i) => (
            <li key={d.alunoId}>
              <Link
                href={`/alunos/${d.alunoId}`}
                className="flex items-center gap-3 rounded-ui border border-line p-3 transition hover:bg-muted/40"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-danger/10 text-xs font-bold text-danger">
                  {i + 1}
                </span>
                <Avatar name={d.nome} src={d.fotoUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{d.nome}</p>
                  <p className="text-xs text-ink/60">{d.diasVencimento} dias em atraso</p>
                </div>
                <span className="shrink-0 rounded-pill bg-danger/10 px-2 py-1 text-sm font-bold text-danger">
                  {money.format(d.valor)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
