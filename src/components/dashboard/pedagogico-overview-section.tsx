import { UsersRound, GraduationCap, BookOpen, Clock, Baby, BookCheck, Library, Award } from "lucide-react";
import type { PedagogicoOverview } from "@/lib/data/pedagogico";

const ETAPA_CFG: Record<string, { icon: typeof Baby; bar: string; text: string; bg: string }> = {
  INFANTIL: {
    icon: Baby,
    bar: "bg-gold",
    text: "text-gold",
    bg: "bg-gold/10",
  },
  FUNDAMENTAL1: {
    icon: BookCheck,
    bar: "bg-brand",
    text: "text-brand",
    bg: "bg-brand/10",
  },
  FUNDAMENTAL2: {
    icon: Library,
    bar: "bg-clay",
    text: "text-clay",
    bg: "bg-clay/10",
  },
  MEDIO: {
    icon: Award,
    bar: "bg-moss",
    text: "text-moss",
    bg: "bg-moss/10",
  },
};

export function PedagogicoOverviewSection({ data }: { data: PedagogicoOverview }) {
  return (
    <section className="rounded-panel bg-gradient-to-b from-muted/30 to-transparent p-5">
      <header className="flex items-center gap-3 mb-4">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/15 text-brand">
          <UsersRound size={16} />
        </span>
        <div>
          <h2 className="font-bold text-ink">Alunos</h2>
          <p className="text-xs text-ink/55">Visão geral dos matriculados</p>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <article className="rounded-panel bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-ui bg-brand/10 text-brand">
              <UsersRound size={14} />
            </span>
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Total alunos</p>
          </div>
          <strong className="mt-2 block text-2xl font-bold text-ink">{data.totalAlunos}</strong>
          <p className="text-xs text-ink/55">matriculados</p>
        </article>

        <article className="rounded-panel bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-ui bg-accent/10 text-accent">
              <GraduationCap size={14} />
            </span>
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Turmas</p>
          </div>
          <strong className="mt-2 block text-2xl font-bold text-ink">{data.totalTurmas}</strong>
          <p className="text-xs text-ink/55">turmas ativas</p>
        </article>

        <article className="rounded-panel bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-ui bg-moss/10 text-moss">
              <BookOpen size={14} />
            </span>
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Séries/anos</p>
          </div>
          <strong className="mt-2 block text-2xl font-bold text-ink">{data.totalSeries}</strong>
          <p className="text-xs text-ink/55">etapas de ensino</p>
        </article>

        <article className="rounded-panel bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-ui bg-warning/10 text-warning">
              <Clock size={14} />
            </span>
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Turnos</p>
          </div>
          <strong className="mt-2 block text-2xl font-bold text-ink">{data.totalTurnos}</strong>
          <p className="text-xs text-ink/55">períodos letivos</p>
        </article>

        {data.porEtapa.slice(0, 2).map((e) => {
          const cfg = ETAPA_CFG[e.etapa];
          const Icon = cfg?.icon ?? BookOpen;
          return (
            <article key={e.etapa} className={`rounded-panel bg-surface p-4 shadow-soft bg-gradient-to-br ${cfg ? `${cfg.bg} to-transparent` : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-ui ${cfg?.bg ?? "bg-muted"} ${cfg?.text ?? "text-ink/60"}`}>
                  <Icon size={14} />
                </span>
                <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55 truncate">{e.label}</p>
              </div>
              <strong className={`mt-2 block text-2xl font-bold ${cfg?.text ?? "text-ink"}`}>{e.count}</strong>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-pill bg-muted overflow-hidden">
                  <div className={`h-1.5 rounded-pill ${cfg?.bar ?? "bg-ink/30"}`} style={{ width: `${e.percent}%` }} />
                </div>
                <span className="shrink-0 text-[0.66rem] font-semibold text-ink/55">{e.percent.toFixed(1)}%</span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-2">
        {data.porEtapa.slice(2).map((e) => {
          const cfg = ETAPA_CFG[e.etapa];
          const Icon = cfg?.icon ?? BookOpen;
          return (
            <article key={e.etapa} className={`rounded-panel bg-surface p-4 shadow-soft bg-gradient-to-br ${cfg ? `${cfg.bg} to-transparent` : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-ui ${cfg?.bg ?? "bg-muted"} ${cfg?.text ?? "text-ink/60"}`}>
                  <Icon size={14} />
                </span>
                <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55 truncate">{e.label}</p>
              </div>
              <strong className={`mt-2 block text-2xl font-bold ${cfg?.text ?? "text-ink"}`}>{e.count}</strong>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-pill bg-muted overflow-hidden">
                  <div className={`h-1.5 rounded-pill ${cfg?.bar ?? "bg-ink/30"}`} style={{ width: `${e.percent}%` }} />
                </div>
                <span className="shrink-0 text-[0.66rem] font-semibold text-ink/55">{e.percent.toFixed(1)}%</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
