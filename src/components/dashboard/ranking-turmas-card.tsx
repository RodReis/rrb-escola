import { Trophy } from "lucide-react";
import type { TurmaRankingRow } from "@/lib/data/dashboard-executive";

// Segmentos com hue do DS (var --c-*) — adaptam ao tema claro/escuro.
const SEG_HUE: Record<string, string> = {
  INFANTIL: "var(--c-amber)",
  FUNDAMENTAL2: "var(--c-coral)",
  MEDIO: "var(--c-green)",
};

// Segmentos que continuam em tokens Tailwind válidos do DS (não alterar).
const SEG_COLOR: Record<string, string> = {
  FUNDAMENTAL1: "bg-brand",
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
            <Trophy size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Ranking de turmas</h3>
            <p className="text-[0.66rem] text-ink/60">por ocupação</p>
          </div>
        </div>
        {items.length > 0 && (
          <span className="rounded-pill bg-brand/15 px-2 py-0.5 text-[0.66rem] font-bold text-brand">
            Top {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/60">
          <Trophy size={24} />
          <p className="text-sm">Nenhuma turma ativa no ano corrente.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-2">
          {items.map((t, i) => {
            const overbook = t.ocupacao > 1;
            const pctVisual = Math.min(t.ocupacao, 1) * 100;
            const hue = SEG_HUE[t.segmento];
            const dotColor = SEG_COLOR[t.segmento] ?? "bg-ink/30";
            const isTop3 = i < 3;
            return (
              <li
                key={t.turmaId}
                className={`rounded-ui border p-3 transition hover:bg-muted/40 ${
                  isTop3 ? "border-brand/30 bg-gradient-to-r from-brand/5 to-transparent" : "border-line"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-pill text-xs font-bold ${
                      i === 0 ? "bg-brand text-paper shadow-soft" :
                      i === 1 || i === 2 ? "text-paper shadow-soft" :
                      "bg-muted text-ink/60"
                    }`}
                    style={
                      i === 1 ? { background: "var(--c-coral)" } :
                      i === 2 ? { background: "var(--c-amber)" } :
                      undefined
                    }
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${hue ? "" : dotColor}`}
                    style={hue ? { background: hue } : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {t.serie} {t.turmaNome}
                    </p>
                    <p className="text-xs text-ink/60">
                      {SEG_LABEL[t.segmento] ?? t.segmento} · {TURNO_LABEL[t.turno] ?? t.turno}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${overbook ? "text-danger" : "text-ink"}`}>
                      {(t.ocupacao * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-ink/60">{t.matriculados}/{t.capacidade}</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-pill bg-muted overflow-hidden">
                  <div
                    className={`h-1.5 ${overbook ? "bg-danger" : hue ? "" : dotColor}`}
                    style={{ width: `${pctVisual}%`, ...(!overbook && hue ? { background: hue } : {}) }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
