import Link from "next/link";
import { Award, ArrowUpRight, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
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
  if (i === 0) return "bg-gold text-paper shadow-soft";
  if (i === 1) return "bg-brand text-paper shadow-soft";
  if (i === 2) return "bg-clay text-paper shadow-soft";
  return "bg-muted text-ink/60";
}

export function RankingAlunosCard({ items }: { items: AlunoRankingRow[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-gold/15 text-gold">
            <Trophy size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Ranking de alunos</h3>
            <p className="text-[0.66rem] text-ink/60">por média geral no ano</p>
          </div>
        </div>
        {items.length > 0 && (
          <span className="rounded-pill bg-gold/15 px-2 py-0.5 text-[0.66rem] font-bold text-gold">
            Top {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/40 py-10 text-ink/60">
          <Award size={28} />
          <p className="text-sm text-center px-4">
            Sem médias consolidadas.
            <br />
            <span className="text-xs">Lance notas em avaliações para gerar o ranking.</span>
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-2">
          {items.map((a, i) => {
            const dotColor = SEG_COLOR[a.segmento] ?? "bg-ink/30";
            const isTop3 = i < 3;
            return (
              <li key={a.alunoId}>
                <Link
                  href={`/alunos/${a.alunoId}`}
                  className={`flex items-center gap-3 rounded-ui border p-3 transition hover:bg-muted/40 ${
                    isTop3 ? "border-gold/30 bg-gradient-to-r from-gold/5 to-transparent" : "border-line"
                  }`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-pill text-xs font-bold ${rankBadge(i)}`}>
                    {i + 1}
                  </span>
                  <Avatar name={a.nome} src={a.fotoUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.nome}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink/60">
                      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                      {SEG_LABEL[a.segmento] ?? a.segmento} · {a.serie} {a.turma}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold leading-none ${
                      a.mediaGeral >= 8 ? "text-success" :
                      a.mediaGeral >= 6 ? "text-brand" :
                      "text-warning"
                    }`}>
                      {a.mediaGeral.toFixed(2)}
                    </p>
                    <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/60">
                      {a.disciplinasComMedia} disc.
                    </p>
                  </div>
                  <ArrowUpRight size={14} className="text-ink/40 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
