import Link from "next/link";
import { Award, ArrowUpRight } from "lucide-react";
import type { AlunoRankingRow } from "@/lib/data/pedagogico";

const SEG_COLOR: Record<string, string> = {
  INFANTIL: "bg-gold",
  FUNDAMENTAL1: "bg-brand",
  FUNDAMENTAL2: "bg-clay",
  MEDIO: "bg-moss",
};

const SEG_LABEL: Record<string, string> = {
  INFANTIL: "Ed. Inf.",
  FUNDAMENTAL1: "Fund. I",
  FUNDAMENTAL2: "Fund. II",
  MEDIO: "Médio",
};

function rankBadge(i: number): string {
  if (i === 0) return "bg-gold text-paper";
  if (i === 1) return "bg-brand text-paper";
  if (i === 2) return "bg-clay text-paper";
  return "bg-muted text-ink/60";
}

export function RankingAlunosCard({ items }: { items: AlunoRankingRow[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-gold/15 text-gold">
          <Award size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Ranking de alunos
        </p>
        <span className="ml-auto text-xs text-ink/55">por média geral</span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">
          Sem médias consolidadas. Lance notas em avaliações para gerar o ranking.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {items.map((a, i) => {
            const dotColor = SEG_COLOR[a.segmento] ?? "bg-ink/30";
            return (
              <li key={a.alunoId}>
                <Link
                  href={`/alunos/${a.alunoId}`}
                  className="flex items-center gap-3 rounded-ui border border-line p-3 hover:bg-muted/40"
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-pill text-xs font-bold ${rankBadge(i)}`}>
                    {i + 1}
                  </span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.nome}</p>
                    <p className="text-xs text-ink/55">
                      {SEG_LABEL[a.segmento] ?? a.segmento} · {a.serie} {a.turma}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold ${
                      a.mediaGeral >= 8 ? "text-success" :
                      a.mediaGeral >= 6 ? "text-brand" :
                      "text-warning"
                    }`}>
                      {a.mediaGeral.toFixed(2)}
                    </p>
                    <p className="text-[0.66rem] text-ink/55">{a.disciplinasComMedia} disc.</p>
                  </div>
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
