import { Users } from "lucide-react";
import type { OcupacaoData } from "@/lib/data/dashboard-executive";

export function ResumoAlunosCard({ ocupacao }: { ocupacao: OcupacaoData }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
          <Users size={16} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-ink">Resumo</h3>
          <p className="text-[0.66rem] text-ink/55">pagantes × beneficiados</p>
        </div>
      </div>
      <dl className="mt-5 grid gap-3">
        <div className="flex items-baseline justify-between">
          <dt className="text-sm text-ink/70">Pagantes</dt>
          <dd className="text-xl font-bold text-ink">{ocupacao.pagantes}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-sm text-ink/70">Beneficiados</dt>
          <dd className="text-xl font-bold text-accent">{ocupacao.beneficiados}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <dt className="text-sm font-semibold text-ink">Total ativos</dt>
          <dd className="text-2xl font-bold text-brand">{ocupacao.ocupadas}</dd>
        </div>
      </dl>
    </article>
  );
}
