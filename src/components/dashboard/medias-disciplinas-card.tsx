import { BookOpen, TrendingUp } from "lucide-react";
import type { MediaDisciplinaRow, PedagogicoSummary } from "@/lib/data/pedagogico";

function colorMedia(media: number | null): string {
  if (media === null) return "bg-muted text-ink/40";
  if (media >= 8) return "bg-success/15 text-success";
  if (media >= 6) return "bg-brand/10 text-brand";
  if (media >= 4) return "bg-warning/15 text-warning";
  return "bg-danger/15 text-danger";
}

export function MediasDisciplinasCard({
  rows,
  summary,
}: {
  rows: MediaDisciplinaRow[];
  summary: PedagogicoSummary;
}) {
  // Agrupa por serie + disciplina, colunas = bimestres
  type Linha = {
    key: string;
    serie: string;
    disciplina: string;
    bims: Array<MediaDisciplinaRow | null>;
  };
  const map = new Map<string, Linha>();
  for (const r of rows) {
    const key = `${r.serie}__${r.disciplina}`;
    const acc = map.get(key) ?? { key, serie: r.serie, disciplina: r.disciplina, bims: [null, null, null, null] };
    acc.bims[r.bimestre - 1] = r;
    map.set(key, acc);
  }
  const linhas = Array.from(map.values()).sort((a, b) => {
    if (a.serie !== b.serie) return a.serie.localeCompare(b.serie);
    return a.disciplina.localeCompare(b.disciplina);
  });

  // Agrupa visualmente: insere flag de inicio-de-serie para cada bloco
  let lastSerie = "";
  const linhasComFlag = linhas.map((l) => {
    const inicio = l.serie !== lastSerie;
    lastSerie = l.serie;
    return { ...l, inicio };
  });

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
            <p className="text-[0.66rem] text-ink/55">médias por disciplina e bimestre</p>
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
            <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/45">
              taxa de aprovação
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/55">Disciplinas</p>
          <strong className="mt-1 block text-lg font-bold text-ink leading-none">{summary.totalDisciplinas}</strong>
        </div>
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/55">Avaliações</p>
          <strong className="mt-1 block text-lg font-bold text-ink leading-none">{summary.totalAvaliacoes}</strong>
        </div>
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/55">Notas lançadas</p>
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

      {linhas.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/40 py-10 text-ink/40">
          <BookOpen size={28} />
          <p className="text-sm text-center px-4">
            Nenhuma nota consolidada.
            <br />
            <span className="text-xs">Cadastre avaliações e lance notas para ver médias aqui.</span>
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[0.6rem] font-bold uppercase tracking-kicker text-ink/55 border-b border-line">
                <th className="px-3 py-2 text-left">Série</th>
                <th className="px-3 py-2 text-left">Disciplina</th>
                <th className="px-3 py-2 text-center">1º Bim</th>
                <th className="px-3 py-2 text-center">2º Bim</th>
                <th className="px-3 py-2 text-center">3º Bim</th>
                <th className="px-3 py-2 text-center">4º Bim</th>
              </tr>
            </thead>
            <tbody>
              {linhasComFlag.map((l, idx) => (
                <tr
                  key={l.key}
                  className={`${l.inicio ? "border-t-2 border-brand/20" : "border-t border-line"} ${
                    idx % 2 === 1 ? "bg-muted/20" : ""
                  } hover:bg-brand/5 transition-colors`}
                >
                  <td className="px-3 py-2.5 text-xs text-ink/70">
                    {l.inicio && <span className="font-bold text-ink">{l.serie}</span>}
                  </td>
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
      )}
    </article>
  );
}
