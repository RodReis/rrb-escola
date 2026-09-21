import { Ticket } from "lucide-react";
import { money } from "@/lib/constants";
import { TrendSpark } from "./trend-spark";
import type { TicketMedioData } from "@/lib/data/dashboard-executive";

export function TicketCard({ data }: { data: TicketMedioData }) {
  return (
    <article className="rounded-panel bg-surface bg-gradient-to-br from-accent/10 to-transparent p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-accent/15 text-accent">
          <Ticket size={16} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-ink">Ticket Médio</h3>
          <p className="text-[0.66rem] text-ink/60">receita / aluno</p>
        </div>
      </div>
      <strong className="mt-4 block text-4xl font-bold leading-none text-ink">{money.format(data.atual)}</strong>
      <div className="mt-4 text-accent">
        <TrendSpark values={data.serie} width={140} height={36} />
      </div>
      <p className="mt-1 text-[0.66rem] uppercase tracking-kicker text-ink/60">últimos 6 meses</p>
    </article>
  );
}
