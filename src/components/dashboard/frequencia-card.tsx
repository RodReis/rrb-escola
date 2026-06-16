import Link from "next/link";
import { CalendarCheck, ArrowUpRight, AlertTriangle } from "lucide-react";
import { TrendSpark } from "./trend-spark";
import type { FrequenciaResumo, FrequenciaPorTurmaRow } from "@/lib/data/dashboard-executive";

const SEG_COLOR: Record<string, string> = {
  INFANTIL: "var(--c-amber)",
  FUNDAMENTAL1: "rgb(var(--color-brand))",
  FUNDAMENTAL2: "var(--c-coral)",
  MEDIO: "var(--c-green)",
};

type Props = {
  data: FrequenciaResumo;
  porTurma?: FrequenciaPorTurmaRow[];
};

export function FrequenciaCard({ data, porTurma = [] }: Props) {
  const pct = data.taxaPresenca * 100;
  const status: "success" | "warning" | "danger" =
    pct >= 90 ? "success" : pct >= 75 ? "warning" : "danger";

  const cfg = {
    success: { text: "text-success", grad: "from-success/10 to-transparent", chip: "bg-success/10 text-success", spark: "text-success" },
    warning: { text: "text-warning", grad: "from-warning/10 to-transparent", chip: "bg-warning/10 text-warning", spark: "text-warning" },
    danger:  { text: "text-danger",  grad: "from-danger/15 to-transparent",  chip: "bg-danger/10 text-danger",  spark: "text-danger" },
  }[status];

  const serieValues = data.serie.map((s) => s.taxa * 100);

  // top 3 turmas com baixa presença (< 75%) que tenham registros
  const turmasProblema = porTurma
    .filter((t) => t.totalRegistros > 0 && t.taxaPresenca < 0.75)
    .slice(0, 3);

  return (
    <article className={`rounded-panel bg-surface bg-gradient-to-br ${cfg.grad} p-6 shadow-soft`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`grid h-9 w-9 place-items-center rounded-ui ${cfg.chip}`}>
            <CalendarCheck size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Frequência</h3>
            <p className="text-[0.66rem] text-ink/55">últimos 30 dias</p>
          </div>
        </div>
        <Link
          href="/frequencias"
          className="text-ink/40 hover:text-ink/70"
          aria-label="Ver detalhes"
        >
          <ArrowUpRight size={14} />
        </Link>
      </div>

      {data.totalRegistros === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/40">
          <CalendarCheck size={24} />
          <p className="text-sm text-center px-3">Sem registros nos últimos 30 dias.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-2">
            <strong className={`text-4xl font-bold leading-none ${cfg.text}`}>{pct.toFixed(1)}%</strong>
            <span className="text-xs text-ink/55">presença média</span>
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-ui bg-muted/40 p-2">
              <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Presentes</dt>
              <dd className="mt-1 font-bold text-success">{data.presentes}</dd>
            </div>
            <div className="rounded-ui bg-muted/40 p-2">
              <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Faltas</dt>
              <dd className="mt-1 font-bold text-danger">{data.faltas}</dd>
            </div>
            <div className="rounded-ui bg-muted/40 p-2">
              <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Dias</dt>
              <dd className="mt-1 font-bold text-ink">{data.diasComRegistro}</dd>
            </div>
          </dl>

          {serieValues.length >= 2 && (
            <div className={`mt-3 ${cfg.spark}`}>
              <TrendSpark values={serieValues} width={220} height={32} />
            </div>
          )}

          {turmasProblema.length > 0 && (
            <div className="mt-4 rounded-ui border border-danger/20 bg-danger/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={12} className="text-danger" />
                <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-danger">
                  Turmas com baixa presença
                </p>
              </div>
              <ul className="grid gap-1.5">
                {turmasProblema.map((t) => (
                  <li key={t.turmaId}>
                    <Link
                      href={`/frequencias?turma=${t.turmaId}`}
                      className="flex items-center gap-2 text-xs hover:underline"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: SEG_COLOR[t.segmento] ?? "rgb(var(--color-ink) / 0.3)" }}
                      />
                      <span className="truncate text-ink">{t.serie} {t.turmaNome}</span>
                      <span className="ml-auto font-bold text-danger">
                        {(t.taxaPresenca * 100).toFixed(0)}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </article>
  );
}
