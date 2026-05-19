import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { FrequenciaDetalhada } from "@/lib/data/pedagogico";

const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function colorFromTaxa(taxa: number, total: number): string {
  if (total === 0) return "bg-muted/30";
  if (taxa >= 0.95) return "bg-success";
  if (taxa >= 0.85) return "bg-success/60";
  if (taxa >= 0.75) return "bg-warning/70";
  if (taxa >= 0.5) return "bg-warning";
  return "bg-danger";
}

type Grupo = { mes: string; rotulo: string; dias: FrequenciaDetalhada["heatmap"] };

function agruparPorMes(heatmap: FrequenciaDetalhada["heatmap"]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const d of heatmap) {
    const mes = d.data.slice(0, 7);
    const m = Number(mes.slice(5, 7));
    const rotulo = `${MESES[m - 1] ?? mes} ${mes.slice(2, 4)}`;
    const acc = map.get(mes) ?? { mes, rotulo, dias: [] };
    acc.dias.push(d);
    map.set(mes, acc);
  }
  return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
}

export function FrequenciaHeatmap({ data }: { data: FrequenciaDetalhada }) {
  const { heatmap, topFaltosos } = data;
  const grupos = agruparPorMes(heatmap);

  // Resumo geral periodo
  const totP = heatmap.reduce((s, d) => s + d.presentes, 0);
  const totF = heatmap.reduce((s, d) => s + d.faltas, 0);
  const taxaGeral = totP + totF > 0 ? totP / (totP + totF) : 0;

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
            <CalendarDays size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Frequência detalhada</h3>
            <p className="text-[0.66rem] text-ink/55">últimos 60 dias</p>
          </div>
        </div>
        {heatmap.length > 0 && (
          <div className="text-right">
            <strong className={`block text-2xl font-bold leading-none ${
              taxaGeral >= 0.9 ? "text-success" : taxaGeral >= 0.75 ? "text-warning" : "text-danger"
            }`}>
              {(taxaGeral * 100).toFixed(1)}%
            </strong>
            <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/45">
              taxa geral
            </p>
          </div>
        )}
      </div>

      {heatmap.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/40 py-10 text-ink/40">
          <CalendarDays size={28} />
          <p className="text-sm">Sem registros nos últimos 60 dias.</p>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55 mb-3">
              Heatmap diário
            </p>
            <div className="grid gap-3">
              {grupos.map((g) => (
                <div key={g.mes}>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/45 mb-1.5">
                    {g.rotulo}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {g.dias.map((d) => {
                      const total = d.presentes + d.faltas;
                      const color = colorFromTaxa(d.taxa, total);
                      const dia = d.data.slice(8, 10);
                      return (
                        <div
                          key={d.data}
                          title={`${d.data} · ${(d.taxa * 100).toFixed(0)}% (${d.presentes}P / ${d.faltas}F)`}
                          className={`grid h-7 w-7 place-items-center rounded-ui text-[0.6rem] font-bold transition hover:scale-110 ${color} ${
                            total === 0 ? "text-ink/30" : "text-paper"
                          }`}
                        >
                          {dia}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[0.6rem] text-ink/45">
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
            <div className="mt-6">
              <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55 mb-3">
                Top 10 faltosos
              </p>
              <ul className="grid gap-1.5">
                {topFaltosos.map((a, i) => (
                  <li key={a.alunoId}>
                    <Link
                      href={`/alunos/${a.alunoId}`}
                      className="flex items-center gap-3 rounded-ui border border-line p-2 transition hover:bg-muted/60"
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-pill bg-muted text-[0.6rem] font-bold text-ink/60">
                        {i + 1}
                      </span>
                      <Avatar name={a.nome} src={a.fotoUrl} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink">{a.nome}</p>
                        <p className="text-[0.66rem] text-ink/55">{a.turma}</p>
                      </div>
                      <span className="shrink-0 rounded-pill bg-danger/10 px-2 py-0.5 text-[0.66rem] font-bold text-danger">
                        {a.faltas} faltas
                      </span>
                      <span className="shrink-0 text-[0.66rem] font-semibold text-ink/55 w-9 text-right">
                        {(a.taxa * 100).toFixed(0)}%
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
