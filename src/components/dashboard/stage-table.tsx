import { money } from "@/lib/constants";
import type { StageBreakdownRow } from "@/lib/data/dashboard-executive";

const LABELS: Record<string, string> = {
  INFANTIL: "Ed. Infantil",
  FUNDAMENTAL1: "Fund. I",
  FUNDAMENTAL2: "Fund. II",
  MEDIO: "Médio",
  outros: "Outros",
};

export function StageTable({ rows }: { rows: StageBreakdownRow[] }) {
  const totalAlunos = rows.reduce((s, r) => s + r.alunos, 0);
  const totalReceita = rows.reduce((s, r) => s + r.receita, 0);
  const ticketMedio = totalAlunos > 0 ? totalReceita / totalAlunos : 0;

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Detalhamento por etapa</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
              <th className="px-2 py-2 text-left">Etapa</th>
              <th className="px-2 py-2 text-right">Alunos</th>
              <th className="px-2 py-2 text-right">Receita</th>
              <th className="px-2 py-2 text-right">Ticket</th>
              <th className="px-2 py-2 text-right">Ocupação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.etapa} className="border-t border-line">
                <td className="px-2 py-2 font-medium text-ink">{LABELS[r.etapa] ?? r.etapa}</td>
                <td className="px-2 py-2 text-right">{r.alunos}</td>
                <td className="px-2 py-2 text-right">{money.format(r.receita)}</td>
                <td className="px-2 py-2 text-right">{money.format(r.ticket)}</td>
                <td className="px-2 py-2 text-right">{(r.ocupacao * 100).toFixed(0)}%</td>
              </tr>
            ))}
            <tr className="border-t border-line font-semibold">
              <td className="px-2 py-2">Total</td>
              <td className="px-2 py-2 text-right">{totalAlunos}</td>
              <td className="px-2 py-2 text-right">{money.format(totalReceita)}</td>
              <td className="px-2 py-2 text-right">{money.format(ticketMedio)}</td>
              <td className="px-2 py-2 text-right">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
