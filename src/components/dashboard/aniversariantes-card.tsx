import Link from "next/link";
import { Cake, PartyPopper } from "lucide-react";
import type { AniversarianteRow } from "@/lib/data/dashboard-executive";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function AniversariantesCard({ items }: { items: AniversarianteRow[] }) {
  const mesLabel = items[0] ? MESES[items[0].mes - 1] : MESES[new Date().getMonth()];
  const aniversariantesHoje = items.filter((a) => a.hoje);
  const demais = items.filter((a) => !a.hoje);

  return (
    <article
      className="rounded-panel bg-surface p-6 shadow-soft"
      style={{ background: "color-mix(in oklab, var(--c-amber) 12%, var(--surface))" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="grid h-9 w-9 place-items-center rounded-ui"
            style={{ background: "color-mix(in oklab, var(--c-amber) 15%, var(--surface))", color: "var(--c-amber)" }}
          >
            <Cake size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Aniversariantes do mês</h3>
            <p className="text-[0.66rem] text-ink/55">{mesLabel}</p>
          </div>
        </div>
        {items.length > 0 && (
          <span
            className="rounded-pill px-2 py-0.5 text-[0.66rem] font-bold"
            style={{ background: "color-mix(in oklab, var(--c-amber) 20%, var(--surface))", color: "var(--c-amber)" }}
          >
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/40">
          <Cake size={24} />
          <p className="text-sm">Nenhum aniversário neste mês.</p>
        </div>
      )}

      {aniversariantesHoje.length > 0 && (
        <div
          className="mt-4 rounded-ui border p-3"
          style={{
            borderColor: "color-mix(in oklab, var(--c-amber) 30%, var(--border))",
            background: "color-mix(in oklab, var(--c-amber) 14%, var(--surface))",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <PartyPopper size={14} style={{ color: "var(--c-amber)" }} />
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker" style={{ color: "var(--c-amber)" }}>
              Hoje!
            </p>
          </div>
          <ul className="grid gap-2">
            {aniversariantesHoje.map((a) => (
              <li key={a.alunoId}>
                <Link
                  href={`/alunos/${a.alunoId}`}
                  className="flex items-center gap-3 rounded-ui bg-surface p-2 border hover:bg-muted/60"
                  style={{ borderColor: "color-mix(in oklab, var(--c-amber) 40%, var(--border))" }}
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-pill text-paper text-sm font-bold shadow-soft"
                    style={{ background: "var(--c-amber)" }}
                  >
                    {String(a.dia).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{a.nome}</p>
                    <p className="text-xs font-semibold" style={{ color: "var(--c-amber)" }}>Aniversário hoje · {a.diaSemana}</p>
                  </div>
                  <PartyPopper size={18} className="shrink-0" style={{ color: "var(--c-amber)" }} />
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
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-pill text-xs font-bold ${
                    a.proximo ? "" : "bg-muted text-ink/40"
                  }`}
                  style={a.proximo ? { background: "color-mix(in oklab, var(--c-amber) 20%, var(--surface))", color: "var(--c-amber)" } : undefined}
                >
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
