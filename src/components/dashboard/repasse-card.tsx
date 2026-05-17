import { Wallet } from "lucide-react";
import { money } from "@/lib/constants";
import { DeltaBadge } from "./delta-badge";
import type { RepasseData } from "@/lib/data/dashboard-executive";

export function RepasseCard({ data }: { data: RepasseData }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-muted text-brand">
          <Wallet size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Repasse recebido</p>
      </div>
      <strong className="mt-3 block text-3xl font-bold text-ink">{money.format(data.valor)}</strong>
      <div className="mt-2">
        <DeltaBadge current={data.valor} previous={data.valorPrev} />
      </div>
      <p className="mt-2 text-sm text-ink/60">no mês corrente</p>
    </article>
  );
}
