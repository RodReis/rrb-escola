import { CalendarDays } from "lucide-react";
import type { FrequenciaDetalhada } from "@/lib/data/pedagogico";

function colorFromTaxa(taxa: number, total: number): string {
  if (total === 0) return "bg-muted/30";
  if (taxa >= 0.95) return "bg-success";
  if (taxa >= 0.85) return "bg-success/60";
  if (taxa >= 0.75) return "bg-warning/70";
  if (taxa >= 0.5) return "bg-warning";
  return "bg-danger";
}

export function FrequenciaHeatmap({ data }: { data: FrequenciaDetalhada }) {
  const { heatmap, topFaltosos } = data;

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
          <CalendarDays size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Frequência detalhada (60 dias)
        </p>
      </div>

      {heatmap.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Sem registros nos últimos 60 dias.</p>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55 mb-2">Heatmap diário</p>
            <div className="flex flex-wrap gap-1">
              {heatmap.map((d) => {
                const total = d.presentes + d.faltas;
                const color = colorFromTaxa(d.taxa, total);
                const dia = d.data.slice(8, 10);
                return (
                  <div
                    key={d.data}
                    title={`${d.data} · ${(d.taxa * 100).toFixed(0)}% (${d.presentes}P / ${d.faltas}F)`}
                    className={`grid h-7 w-7 place-items-center rounded-ui text-[0.6rem] font-bold ${color} ${
                      total === 0 ? "text-ink/30" : "text-paper"
                    }`}
                  >
                    {dia}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[0.66rem] text-ink/55">
              <span>Baixa</span>
              <span className="h-3 w-3 rounded-sm bg-danger" />
              <span className="h-3 w-3 rounded-sm bg-warning" />
              <span className="h-3 w-3 rounded-sm bg-warning/70" />
              <span className="h-3 w-3 rounded-sm bg-success/60" />
              <span className="h-3 w-3 rounded-sm bg-success" />
              <span>Alta</span>
            </div>
          </div>

          {topFaltosos.length > 0 && (
            <div className="mt-5">
              <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55 mb-2">Top 10 faltosos</p>
              <ul className="grid gap-1.5">
                {topFaltosos.map((a, i) => (
                  <li key={a.alunoId} className="flex items-center gap-2 text-xs">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-pill bg-muted text-[0.6rem] font-bold text-ink/60">
                      {i + 1}
                    </span>
                    <span className="truncate text-ink">{a.nome}</span>
                    <span className="text-ink/55 shrink-0">· {a.turma}</span>
                    <span className="ml-auto shrink-0 rounded-pill bg-danger/10 px-2 py-0.5 font-bold text-danger">
                      {a.faltas} faltas
                    </span>
                    <span className="shrink-0 text-ink/55">{(a.taxa * 100).toFixed(0)}%</span>
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
