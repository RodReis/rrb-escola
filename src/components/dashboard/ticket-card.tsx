import { money } from "@/lib/constants";
import { TrendSpark } from "./trend-spark";
import type { TicketMedioData } from "@/lib/data/dashboard-executive";

export function TicketCard({ data }: { data: TicketMedioData }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Ticket Médio</p>
      <strong className="mt-3 block text-3xl font-bold text-ink">{money.format(data.atual)}</strong>
      <div className="mt-3 text-brand">
        <TrendSpark values={data.serie} width={120} height={32} />
      </div>
      <p className="mt-1 text-sm text-ink/60">últimos 6 meses</p>
    </article>
  );
}
