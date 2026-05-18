import { Trophy } from "lucide-react";
import type { TurmaRankingRow } from "@/lib/data/dashboard-executive";

const SEG_COLOR: Record<string, string> = {
  INFANTIL: "bg-gold",
  FUNDAMENTAL1: "bg-brand",
  FUNDAMENTAL2: "bg-clay",
  MEDIO: "bg-moss",
  outros: "bg-ink/30",
};

const SEG_LABEL: Record<string, string> = {
  INFANTIL: "Ed. Inf.",
  FUNDAMENTAL1: "Fund. I",
  FUNDAMENTAL2: "Fund. II",
  MEDIO: "Médio",
};

const TURNO_LABEL: Record<string, string> = {
  matutino: "Mat.",
  vespertino: "Vesp.",
  noturno: "Not.",
  integral: "Int.",
};

export function RankingTurmasCard({ items }: { items: TurmaRankingRow[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
          <Trophy size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Ranking de turmas
        </p>
        <span className="ml-auto text-xs text-ink/55">por ocupação</span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Nenhuma turma ativa no ano corrente.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {items.map((t, i) => {
            const overbook = t.ocupacao > 1;
            const pctVisual = Math.min(t.ocupacao, 1) * 100;
            const dotColor = SEG_COLOR[t.segmento] ?? "bg-ink/30";
            return (
              <li key={t.turmaId} className="rounded-ui border border-line p-3 hover:bg-muted/40">
                <div className="flex items-center gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-pill text-xs font-bold ${
                    i === 0 ? "bg-brand text-paper" : "bg-muted text-ink/60"
                  }`}>
                    {i + 1}
                  </span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {t.serie} {t.turmaNome}
                    </p>
                    <p className="text-xs text-ink/55">
                      {SEG_LABEL[t.segmento] ?? t.segmento} · {TURNO_LABEL[t.turno] ?? t.turno}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${overbook ? "text-danger" : "text-ink"}`}>
                      {(t.ocupacao * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-ink/55">{t.matriculados}/{t.capacidade}</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-pill bg-muted overflow-hidden">
                  <div className={`h-1.5 ${overbook ? "bg-danger" : dotColor}`} style={{ width: `${pctVisual}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
