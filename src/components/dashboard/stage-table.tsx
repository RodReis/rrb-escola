import { money } from "@/lib/constants";
import type { StageBreakdownRow } from "@/lib/data/dashboard-executive";

const LABELS: Record<string, string> = {
  INFANTIL: "Ed. Infantil",
  FUNDAMENTAL1: "Fund. I",
  FUNDAMENTAL2: "Fund. II",
  MEDIO: "Médio",
  outros: "Outros",
};

const ETAPA_COLOR: Record<string, string> = {
  INFANTIL: "bg-gold",
  FUNDAMENTAL1: "bg-brand",
  FUNDAMENTAL2: "bg-clay",
  MEDIO: "bg-moss",
  outros: "bg-ink/30",
};

const ETAPA_TEXT: Record<string, string> = {
  INFANTIL: "text-gold",
  FUNDAMENTAL1: "text-brand",
  FUNDAMENTAL2: "text-clay",
  MEDIO: "text-moss",
  outros: "text-ink/60",
};

function ordemEtapa(etapa: string): number {
  const ordem = ["INFANTIL", "FUNDAMENTAL1", "FUNDAMENTAL2", "MEDIO"];
  const i = ordem.indexOf(etapa);
  return i === -1 ? 99 : i;
}

export function StageTable({ rows }: { rows: StageBreakdownRow[] }) {
  const sorted = [...rows].sort((a, b) => ordemEtapa(a.etapa) - ordemEtapa(b.etapa));
  const totalAlunos = sorted.reduce((s, r) => s + r.alunos, 0);
  const totalReceita = sorted.reduce((s, r) => s + r.receita, 0);
  const totalCapacidade = sorted.reduce((s, r) => s + r.capacidade, 0);
  const totalVagas = sorted.reduce((s, r) => s + r.vagasLivres, 0);
  const ticketMedio = totalAlunos > 0 ? totalReceita / totalAlunos : 0;
  const ocupacaoTotal = totalCapacidade > 0 ? totalAlunos / totalCapacidade : 0;

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-baseline justify-between">
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Detalhamento por etapa</p>
        <p className="text-xs text-ink/55">{sorted.length} segmentos</p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
              <th className="px-2 py-2 text-left">Etapa</th>
              <th className="px-2 py-2 text-right">Alunos</th>
              <th className="px-2 py-2 text-right">Capacidade</th>
              <th className="px-2 py-2 text-right">Vagas livres</th>
              <th className="px-2 py-2 text-right">Receita</th>
              <th className="px-2 py-2 text-right">Ticket</th>
              <th className="px-2 py-2 text-left w-44">Ocupação</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const overbook = r.ocupacao > 1;
              const ocupPct = Math.min(r.ocupacao, 1) * 100;
              const dotColor = ETAPA_COLOR[r.etapa] ?? "bg-ink/30";
              const txtColor = ETAPA_TEXT[r.etapa] ?? "text-ink";
              return (
                <tr key={r.etapa} className="border-t border-line">
                  <td className="px-2 py-3">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                      <span className={`font-semibold ${txtColor}`}>{LABELS[r.etapa] ?? r.etapa}</span>
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right font-semibold text-ink">{r.alunos}</td>
                  <td className="px-2 py-3 text-right text-ink/70">{r.capacidade}</td>
                  <td className="px-2 py-3 text-right">
                    {overbook ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                        +{r.alunos - r.capacidade} excedente
                      </span>
                    ) : r.vagasLivres === 0 ? (
                      <span className="text-xs font-semibold text-success">Lotada</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                        {r.vagasLivres} livre{r.vagasLivres > 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right font-semibold text-ink">{money.format(r.receita)}</td>
                  <td className="px-2 py-3 text-right text-ink/70">{money.format(r.ticket)}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full rounded-pill bg-muted overflow-hidden">
                        <div className={`h-2 ${overbook ? "bg-danger" : dotColor}`} style={{ width: `${ocupPct}%` }} />
                      </div>
                      <span className={`shrink-0 text-xs font-bold ${overbook ? "text-danger" : "text-ink/70"}`}>
                        {(r.ocupacao * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-line bg-muted/40 font-bold">
              <td className="px-2 py-3 text-ink">Total</td>
              <td className="px-2 py-3 text-right">{totalAlunos}</td>
              <td className="px-2 py-3 text-right">{totalCapacidade}</td>
              <td className="px-2 py-3 text-right">
                <span className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2 py-0.5 text-xs text-brand">
                  {totalVagas} livres
                </span>
              </td>
              <td className="px-2 py-3 text-right">{money.format(totalReceita)}</td>
              <td className="px-2 py-3 text-right">{money.format(ticketMedio)}</td>
              <td className="px-2 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-full rounded-pill bg-muted overflow-hidden">
                    <div className="h-2 bg-brand" style={{ width: `${Math.min(ocupacaoTotal, 1) * 100}%` }} />
                  </div>
                  <span className="shrink-0 text-xs font-bold text-brand">{(ocupacaoTotal * 100).toFixed(0)}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
