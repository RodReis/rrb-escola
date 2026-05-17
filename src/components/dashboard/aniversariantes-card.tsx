import Link from "next/link";
import { Cake, PartyPopper } from "lucide-react";
import type { AniversarianteRow } from "@/lib/data/dashboard-executive";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function AniversariantesCard({ items }: { items: AniversarianteRow[] }) {
  const mesLabel = items[0] ? MESES[items[0].mes - 1] : MESES[new Date().getMonth()];
  const aniversariantesHoje = items.filter((a) => a.hoje);
  const demais = items.filter((a) => !a.hoje);

  return (
    <article className="rounded-panel bg-surface bg-gradient-to-br from-gold/10 to-transparent p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-gold/15 text-gold">
          <Cake size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Aniversariantes · {mesLabel}
        </p>
        {items.length > 0 && (
          <span className="ml-auto inline-flex items-center justify-center rounded-pill bg-gold/20 px-2 py-0.5 text-[0.66rem] font-bold text-gold">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 && (
        <p className="mt-4 text-sm text-ink/60">Nenhum aniversário neste mês.</p>
      )}

      {aniversariantesHoje.length > 0 && (
        <div className="mt-4 rounded-ui border border-gold/30 bg-gradient-to-br from-gold/20 to-gold/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <PartyPopper size={14} className="text-gold" />
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-gold">
              Hoje!
            </p>
          </div>
          <ul className="grid gap-2">
            {aniversariantesHoje.map((a) => (
              <li key={a.alunoId}>
                <Link
                  href={`/alunos/${a.alunoId}`}
                  className="flex items-center gap-3 rounded-ui bg-surface p-2 ring-1 ring-gold/40 hover:bg-gold/5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-gold text-paper text-sm font-bold shadow-soft">
                    {String(a.dia).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{a.nome}</p>
                    <p className="text-xs font-semibold text-gold">Aniversário hoje · {a.diaSemana}</p>
                  </div>
                  <PartyPopper size={18} className="text-gold shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {demais.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {demais.map((a) => (
            <li key={a.alunoId}>
              <Link
                href={`/alunos/${a.alunoId}`}
                className="flex items-center gap-3 rounded-ui border border-line p-2 hover:bg-muted/60"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-pill text-xs font-bold ${
                  a.proximo ? "bg-gold/20 text-gold" : "bg-muted text-ink/40"
                }`}>
                  {String(a.dia).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{a.nome}</p>
                  <p className="text-xs text-ink/55">{a.diaSemana}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
