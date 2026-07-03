import Link from "next/link";
import { Trophy, Star } from "lucide-react";
import type { AniversarioMatriculaRow } from "@/lib/data/dashboard-executive";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function colorAnos(anos: number): { className: string; style?: React.CSSProperties } {
  if (anos >= 10)
    return {
      className: "text-ink",
      style: {
        background: "color-mix(in oklab, var(--c-amber) 15%, var(--surface))",
        color: "var(--c-amber)",
      },
    };
  if (anos >= 5) return { className: "bg-brand/10 text-brand" };
  if (anos >= 3) return { className: "bg-accent/10 text-accent" };
  return { className: "bg-muted text-ink/60" };
}

export function AniversarioMatriculaCard({ items }: { items: AniversarioMatriculaRow[] }) {
  const mesLabel = items[0]
    ? MESES[new Date(items[0].dataMatricula).getMonth()]
    : MESES[new Date().getMonth()];
  const hoje = items.filter((i) => i.hoje);
  const demais = items.filter((i) => !i.hoje);

  return (
    <article className="rounded-panel bg-surface bg-gradient-to-br from-brand/10 to-transparent p-6 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/15 text-brand">
            <Trophy size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Aniversário na escola</h3>
            <p className="text-[0.66rem] text-ink/60">{mesLabel} · fidelidade</p>
          </div>
        </div>
        {items.length > 0 && (
          <span className="rounded-pill bg-brand/15 px-2 py-0.5 text-[0.66rem] font-bold text-brand">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/60">
          <Trophy size={24} />
          <p className="text-sm">Nenhum aniversário de matrícula este mês.</p>
        </div>
      )}

      {hoje.length > 0 && (
        <div className="mt-4 rounded-ui border border-brand/30 bg-gradient-to-br from-brand/20 to-brand/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Star size={14} className="text-brand fill-brand" />
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-brand">
              Fidelidade hoje
            </p>
          </div>
          <ul className="grid gap-2">
            {hoje.map((a) => (
              <li key={a.alunoId}>
                <Link
                  href={`/alunos/${a.alunoId}`}
                  className="flex items-center gap-3 rounded-ui bg-surface p-2 ring-1 ring-brand/40 hover:bg-brand/5"
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-pill text-sm font-bold shadow-soft ${colorAnos(a.anosNaEscola).className}`}
                    style={colorAnos(a.anosNaEscola).style}
                  >
                    {a.anosNaEscola}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{a.nome}</p>
                    <p className="text-xs font-semibold text-brand">
                      {a.anosNaEscola} ano{a.anosNaEscola > 1 ? "s" : ""} na escola hoje
                    </p>
                  </div>
                  <Star size={16} className="text-brand fill-brand shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {demais.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {demais.map((a) => {
            const dia = new Date(a.dataMatricula).getDate();
            return (
              <li key={a.alunoId}>
                <Link
                  href={`/alunos/${a.alunoId}`}
                  className="flex items-center gap-3 rounded-ui border border-line p-2 hover:bg-muted/60"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-pill text-xs font-bold ${colorAnos(a.anosNaEscola).className}`}
                    style={colorAnos(a.anosNaEscola).style}
                  >
                    {a.anosNaEscola}a
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.nome}</p>
                    <p className="text-xs text-ink/60">
                      Dia {String(dia).padStart(2, "0")} · {a.diaSemana}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
