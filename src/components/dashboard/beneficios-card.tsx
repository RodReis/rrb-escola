import { HandHeart, GraduationCap, HandCoins, Sparkles, BookOpen, type LucideIcon } from "lucide-react";
import { money } from "@/lib/constants";
import type { BeneficiosData, TipoVaga } from "@/lib/data/dashboard-executive";

const LABELS: Record<TipoVaga, string> = {
  paga: "Pagantes",
  bolsa_integral: "Bolsa integral",
  bolsa_parcial: "Bolsa parcial",
  permuta: "Permuta",
  gratuita: "Gratuidade",
};

const ICONS: Record<TipoVaga, LucideIcon> = {
  paga: BookOpen,
  bolsa_integral: GraduationCap,
  bolsa_parcial: GraduationCap,
  permuta: HandCoins,
  gratuita: Sparkles,
};

const ORDEM: TipoVaga[] = ["bolsa_integral", "bolsa_parcial", "permuta", "gratuita"];

export function BeneficiosCard({ data }: { data: BeneficiosData }) {
  return (
    <article className="rounded-panel bg-surface bg-gradient-to-br from-accent/10 to-transparent p-6 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-accent/15 text-accent">
            <HandHeart size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Benefícios</h3>
            <p className="text-[0.66rem] text-ink/60">bolsas, permutas e gratuidades</p>
          </div>
        </div>
      </div>

      <strong className="mt-4 block text-4xl font-bold leading-none text-ink">{data.total}</strong>
      <p className="mt-1 text-[0.66rem] uppercase tracking-kicker text-ink/60">alunos beneficiados</p>

      <ul className="mt-4 grid gap-2">
        {ORDEM.map((tipo) => {
          const count = data.porTipo[tipo] ?? 0;
          if (count === 0) return null;
          const Icon = ICONS[tipo];
          return (
            <li key={tipo} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-ink/70">
                <Icon size={14} className="text-accent" />
                {LABELS[tipo]}
              </span>
              <span className="rounded-pill bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">{count}</span>
            </li>
          );
        })}
      </ul>

      {data.receitaPerdidaEstimada > 0 && (
        <p className="mt-4 rounded-ui bg-warning/10 px-3 py-2 text-xs text-warning">
          Receita não realizada: <strong>{money.format(data.receitaPerdidaEstimada)}</strong>/mês
        </p>
      )}
    </article>
  );
}
