import { BookOpen } from "lucide-react";
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
  // Agrupa por serie+disciplina, colunas = bimestres
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
  const linhas = Array.from(map.values());

  const totalAlunos = summary.aprovados + summary.reprovados;
  const taxaAprovacao = totalAlunos > 0 ? summary.aprovados / totalAlunos : 0;

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
          <BookOpen size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Médias por disciplina
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Disciplinas</p>
          <strong className="mt-1 block text-lg font-bold text-ink">{summary.totalDisciplinas}</strong>
        </div>
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Avaliações</p>
          <strong className="mt-1 block text-lg font-bold text-ink">{summary.totalAvaliacoes}</strong>
        </div>
        <div className="rounded-ui bg-muted/40 p-3">
          <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Notas lançadas</p>
          <strong className="mt-1 block text-lg font-bold text-ink">{summary.totalNotasLancadas}</strong>
        </div>
        <div className="rounded-ui bg-success/10 p-3">
          <p className="text-[0.66rem] uppercase tracking-kicker text-success/80">Aprovados</p>
          <strong className="mt-1 block text-lg font-bold text-success">{summary.aprovados}</strong>
        </div>
        <div className="rounded-ui bg-danger/10 p-3">
          <p className="text-[0.66rem] uppercase tracking-kicker text-danger/80">Reprovados</p>
          <strong className="mt-1 block text-lg font-bold text-danger">{summary.reprovados}</strong>
        </div>
      </div>

      {totalAlunos > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-ink/55">Taxa de aprovação</span>
            <strong className="text-sm font-bold text-success">{(taxaAprovacao * 100).toFixed(1)}%</strong>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-pill bg-muted overflow-hidden">
            <div className="h-1.5 bg-success" style={{ width: `${taxaAprovacao * 100}%` }} />
          </div>
        </div>
      )}

      {linhas.length === 0 ? (
        <p className="mt-5 text-sm text-ink/60">Nenhuma nota consolidada. Cadastre avaliações e lance notas para ver médias aqui.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
                <th className="px-2 py-2 text-left">Série</th>
                <th className="px-2 py-2 text-left">Disciplina</th>
                <th className="px-2 py-2 text-center">1º Bim</th>
                <th className="px-2 py-2 text-center">2º Bim</th>
                <th className="px-2 py-2 text-center">3º Bim</th>
                <th className="px-2 py-2 text-center">4º Bim</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.key} className="border-t border-line">
                  <td className="px-2 py-2 text-ink/70">{l.serie}</td>
                  <td className="px-2 py-2 font-semibold text-ink">{l.disciplina}</td>
                  {l.bims.map((b, i) => (
                    <td key={i} className="px-2 py-2 text-center">
                      <span className={`inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-pill px-2 text-xs font-bold ${colorMedia(b?.media ?? null)}`}>
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
