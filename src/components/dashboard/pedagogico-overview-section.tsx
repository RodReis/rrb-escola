import { UsersRound, GraduationCap, BookOpen, Clock, Baby, BookCheck, Library, Award } from "lucide-react";
import type { PedagogicoOverview } from "@/lib/data/pedagogico";

const ETAPA_CFG: Record<string, { icon: typeof Baby; bar: string; text: string; bg: string; ring: string }> = {
  INFANTIL: {
    icon: Baby,
    bar: "bg-gold",
    text: "text-gold",
    bg: "bg-gold/10",
    ring: "ring-gold/20",
  },
  FUNDAMENTAL1: {
    icon: BookCheck,
    bar: "bg-brand",
    text: "text-brand",
    bg: "bg-brand/10",
    ring: "ring-brand/20",
  },
  FUNDAMENTAL2: {
    icon: Library,
    bar: "bg-clay",
    text: "text-clay",
    bg: "bg-clay/10",
    ring: "ring-clay/20",
  },
  MEDIO: {
    icon: Award,
    bar: "bg-moss",
    text: "text-moss",
    bg: "bg-moss/10",
    ring: "ring-moss/20",
  },
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
          return (
            <article
              key={e.etapa}
              className={`rounded-ui p-4 ring-1 ${cfg ? cfg.ring : "ring-line"} ${cfg ? `bg-gradient-to-br ${cfg.bg} to-transparent` : "bg-muted/30"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-ui ${cfg?.bg ?? "bg-muted"} ${cfg?.text ?? "text-ink/60"}`}>
                    <Icon size={14} />
                  </span>
                  <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55 truncate">
                    {e.label}
                  </p>
                </div>
                <span className={`text-[0.66rem] font-bold ${cfg?.text ?? "text-ink/60"}`}>
                  {e.percent.toFixed(1)}%
                </span>
              </div>
              <strong className={`mt-3 block text-3xl font-bold leading-none ${cfg?.text ?? "text-ink"}`}>
                {e.count}
              </strong>
              <p className="mt-1 text-[0.66rem] text-ink/55">alunos matriculados</p>
              <div className="mt-3 h-1.5 w-full rounded-pill bg-muted overflow-hidden">
                <div className={`h-1.5 rounded-pill ${cfg?.bar ?? "bg-ink/30"}`} style={{ width: `${e.percent}%` }} />
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
