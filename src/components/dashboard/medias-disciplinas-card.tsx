"use client";

import { useMemo, useState } from "react";
import { BookOpen, TrendingUp } from "lucide-react";
import type { MediaDisciplinaRow, PedagogicoSummary } from "@/lib/data/pedagogico";
import { compareSerie } from "@/lib/data/pedagogico-constants";

function colorMedia(media: number | null): string {
  if (media === null) return "bg-muted text-ink/40";
  if (media >= 8) return "bg-success/15 text-success";
  if (media >= 6) return "bg-brand/10 text-brand";
  if (media >= 4) return "bg-warning/15 text-warning";
  return "bg-danger/15 text-danger";
}

type LinhaDisciplina = {
  key: string;
  disciplina: string;
  bims: Array<MediaDisciplinaRow | null>;
};

export function MediasDisciplinasCard({
  rows,
  summary,
}: {
  rows: MediaDisciplinaRow[];
  summary: PedagogicoSummary;
}) {
  const series = useMemo(
    () => Array.from(new Set(rows.map((r) => r.serie))).sort(compareSerie),
    [rows]
  );
  const [serieAtiva, setSerieAtiva] = useState<string | null>(series[0] ?? null);
  const serieSelecionada = serieAtiva && series.includes(serieAtiva) ? serieAtiva : series[0] ?? null;

  const linhasDaSerie = useMemo(() => {
    const map = new Map<string, LinhaDisciplina>();
    for (const r of rows) {
      if (r.serie !== serieSelecionada) continue;
      const acc = map.get(r.disciplina) ?? { key: r.disciplina, disciplina: r.disciplina, bims: [null, null, null, null] };
      acc.bims[r.bimestre - 1] = r;
      map.set(r.disciplina, acc);
    }
    return Array.from(map.values()).sort((a, b) => a.disciplina.localeCompare(b.disciplina));
  }, [rows, serieSelecionada]);

  const totalAlunos = summary.aprovados + summary.reprovados;
  const taxaAprovacao = totalAlunos > 0 ? summary.aprovados / totalAlunos : 0;

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
            <BookOpen size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Notas e desempenho</h3>
            <p className="text-[0.66rem] text-ink/60">médias por disciplina e bimestre</p>
          </div>
        </div>
        {totalAlunos > 0 && (
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 text-success">
              <TrendingUp size={12} />
              <strong className="text-2xl font-bold leading-none">
                {(taxaAprovacao * 100).toFixed(1)}%
              </strong>
            </div>
            <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/60">
              taxa de aprovação
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/60">Disciplinas</p>
          <strong className="mt-1 block text-lg font-bold text-ink leading-none">{summary.totalDisciplinas}</strong>
        </div>
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/60">Avaliações</p>
          <strong className="mt-1 block text-lg font-bold text-ink leading-none">{summary.totalAvaliacoes}</strong>
        </div>
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/60">Notas lançadas</p>
          <strong className="mt-1 block text-lg font-bold text-ink leading-none">{summary.totalNotasLancadas}</strong>
        </div>
        <div className="rounded-ui bg-success/10 p-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-success/80">Aprovados</p>
          <strong className="mt-1 block text-lg font-bold text-success leading-none">{summary.aprovados}</strong>
        </div>
        <div className="rounded-ui bg-danger/10 p-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-danger/80">Reprovados</p>
          <strong className="mt-1 block text-lg font-bold text-danger leading-none">{summary.reprovados}</strong>
        </div>
      </div>

      {totalAlunos > 0 && (
        <div className="mt-3 h-1.5 w-full rounded-pill bg-muted overflow-hidden">
          <div className="h-1.5 bg-success transition-all" style={{ width: `${taxaAprovacao * 100}%` }} />
        </div>
      )}

      {series.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/40 py-10 text-ink/60">
          <BookOpen size={28} />
          <p className="text-sm text-center px-4">
            Nenhuma nota consolidada.
            <br />
            <span className="text-xs">Cadastre avaliações e lance notas para ver médias aqui.</span>
          </p>
        </div>
      ) : (
        <>
          <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line no-scrollbar" role="tablist" aria-label="Série">
            {series.map((serie) => {
              const isActive = serie === serieSelecionada;
              return (
                <button
                  key={serie}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSerieAtiva(serie)}
                  className={`relative shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors ${
                    isActive ? "text-brand" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {serie}
                  {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[0.6rem] font-bold uppercase tracking-kicker text-ink/60 border-b border-line">
                  <th className="px-3 py-2 text-left">Disciplina</th>
                  <th className="px-3 py-2 text-center">1º Bim</th>
                  <th className="px-3 py-2 text-center">2º Bim</th>
                  <th className="px-3 py-2 text-center">3º Bim</th>
                  <th className="px-3 py-2 text-center">4º Bim</th>
                </tr>
              </thead>
              <tbody>
                {linhasDaSerie.map((l, idx) => (
                  <tr
                    key={l.key}
                    className={`border-t border-line ${idx % 2 === 1 ? "bg-muted/20" : ""} hover:bg-brand/5 transition-colors`}
                  >
                    <td className="px-3 py-2.5 text-sm font-semibold text-ink">{l.disciplina}</td>
                    {l.bims.map((b, i) => (
                      <td key={i} className="px-3 py-2.5 text-center">
                        <span className={`inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded-pill px-2 text-xs font-bold ${colorMedia(b?.media ?? null)}`}>
                          {b?.media != null ? b.media.toFixed(1) : "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </article>
  );
}
