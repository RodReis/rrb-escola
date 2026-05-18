import Link from "next/link";
import { HandHeart, ArrowUpRight } from "lucide-react";
import { money } from "@/lib/constants";
import type { BeneficiosData } from "@/lib/data/dashboard-executive";

export function BolsistasReceitaCard({ data }: { data: BeneficiosData }) {
  const anual = data.receitaPerdidaEstimada * 12;

  return (
    <article className="rounded-panel bg-surface bg-gradient-to-br from-warning/10 to-transparent p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-warning/15 text-warning">
          <HandHeart size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
          Receita perdida (bolsistas)
        </p>
        <Link
          href="/bolsistas"
          className="ml-auto text-ink/40 hover:text-ink/70"
          aria-label="Ver bolsistas"
        >
          <ArrowUpRight size={14} />
        </Link>
      </div>

      {data.total === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Sem bolsistas ativos.</p>
      ) : (
        <>
          <strong className="mt-3 block text-3xl font-bold text-warning">
            {money.format(data.receitaPerdidaEstimada)}
          </strong>
          <p className="text-xs text-ink/55">{data.total} alunos · por mês</p>

          <div className="mt-3 rounded-ui bg-warning/10 px-3 py-2">
            <p className="text-[0.66rem] uppercase tracking-kicker text-warning/80">Anual estimado</p>
            <strong className="mt-0.5 block text-base font-bold text-warning">
              {money.format(anual)}
            </strong>
          </div>
        </>
      )}
    </article>
  );
}
