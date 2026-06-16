import { UsersRound, GraduationCap, BookOpen, Clock, Baby, BookCheck, Library, Award } from "lucide-react";
import type { PedagogicoOverview } from "@/lib/data/pedagogico";

// Hue do DS por etapa (mesmo tratamento dos KPI cards da aba Financeiro:
// tinta de fundo por hue, chip de ícone sólido, valor em --text).
const ETAPA_CFG: Record<string, { icon: typeof Baby; hue: string }> = {
  INFANTIL: { icon: Baby, hue: "var(--c-amber)" },
  FUNDAMENTAL1: { icon: BookCheck, hue: "var(--c-blue)" },
  FUNDAMENTAL2: { icon: Library, hue: "var(--c-coral)" },
  MEDIO: { icon: Award, hue: "var(--c-green)" },
};

export function PedagogicoOverviewSection({ data }: { data: PedagogicoOverview }) {
  return (
    <section className="rounded-panel bg-surface p-6 shadow-soft">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Visão geral pedagógica</h2>
          <p className="mt-1 text-xs text-ink/55">
            Distribuição de alunos por etapa, séries e turnos no ano corrente.
          </p>
        </div>
        <div className="flex items-baseline gap-6 text-right">
          <Stat label="Alunos" value={data.totalAlunos} icon={UsersRound} tone="brand" />
          <Stat label="Turmas" value={data.totalTurmas} icon={GraduationCap} tone="accent" />
          <Stat label="Séries" value={data.totalSeries} icon={BookOpen} tone="moss" />
          <Stat label="Turnos" value={data.totalTurnos} icon={Clock} tone="warning" />
        </div>
      </header>

      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {data.porEtapa.map((e) => {
          const cfg = ETAPA_CFG[e.etapa];
          const Icon = cfg?.icon ?? BookOpen;
          const hue = cfg?.hue ?? "var(--c-blue)";
          return (
            <article
              key={e.etapa}
              className="rounded-panel border p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
              style={{
                borderColor: `color-mix(in oklab, ${hue} var(--tint-border), var(--border))`,
                backgroundImage: `linear-gradient(165deg, color-mix(in oklab, ${hue} calc(var(--tint-strength) + 4%), var(--surface)), var(--surface) 78%)`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-ui text-white"
                    style={{ background: hue, boxShadow: `0 6px 14px -6px ${hue}` }}
                  >
                    <Icon size={16} />
                  </span>
                  <p className="truncate text-[0.66rem] font-semibold uppercase tracking-kicker" style={{ color: "var(--text-muted)" }}>
                    {e.label}
                  </p>
                </div>
                <span className="shrink-0 text-[0.66rem] font-bold tabular-nums" style={{ color: hue }}>
                  {e.percent.toFixed(1)}%
                </span>
              </div>
              <strong className="mt-3 block font-display text-3xl font-bold leading-none tabular-nums text-ink">
                {e.count}
              </strong>
              <p className="mt-1.5 text-[0.66rem]" style={{ color: "var(--text-muted)" }}>alunos matriculados</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-pill" style={{ background: "var(--surface-3)" }}>
                <div className="h-1.5 rounded-pill" style={{ width: `${e.percent}%`, background: hue }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof UsersRound;
  tone: "brand" | "accent" | "moss" | "warning";
}) {
  const toneMap = {
    brand: "text-brand bg-brand/10",
    accent: "text-accent bg-accent/10",
    moss: "text-moss bg-moss/10",
    warning: "text-warning bg-warning/10",
  };
  return (
    <div className="flex flex-col items-end">
      <span className={`grid h-7 w-7 place-items-center rounded-ui ${toneMap[tone]}`}>
        <Icon size={12} />
      </span>
      <strong className="mt-1 text-xl font-bold text-ink leading-none">{value}</strong>
      <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/45">{label}</p>
    </div>
  );
}
