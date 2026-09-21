import Link from "next/link";
import { HandHeart, ArrowUpRight } from "lucide-react";
import { money } from "@/lib/constants";
import type { BeneficiosData } from "@/lib/data/dashboard-executive";

export function BolsistasReceitaCard({ data }: { data: BeneficiosData }) {
  const anual = data.receitaPerdidaEstimada * 12;

  return (
    <article className="rounded-panel bg-surface bg-gradient-to-br from-warning/10 to-transparent p-6 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-warning/15 text-warning">
            <HandHeart size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Receita perdida</h3>
            <p className="text-[0.66rem] text-ink/60">bolsistas e benefícios</p>
          </div>
        </div>
        <Link
          href="/bolsistas"
          className="text-ink/40 hover:text-ink/70"
          aria-label="Ver bolsistas"
        >
          <ArrowUpRight size={14} />
        </Link>
      </div>

      {data.total === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/60">
          <HandHeart size={24} />
          <p className="text-sm">Sem bolsistas ativos.</p>
        </div>
      ) : (
        <>
          <strong className="mt-4 block text-4xl font-bold leading-none text-warning">
            {money.format(data.receitaPerdidaEstimada)}
          </strong>
          <p className="mt-1 text-xs text-ink/60">{data.total} alunos · por mês</p>

          <div className="mt-4 rounded-ui bg-warning/10 px-3 py-2.5">
            <p className="text-[0.6rem] font-semibold uppercase tracking-kicker text-warning/80">Anual estimado</p>
            <strong className="mt-0.5 block text-base font-bold text-warning leading-none">
              {money.format(anual)}
            </strong>
          </div>
        </>
      )}
    </article>
  );
}
