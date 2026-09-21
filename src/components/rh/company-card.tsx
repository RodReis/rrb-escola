import Link from "next/link";
import { Building2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { toggleCompanyAction } from "@/lib/actions/rh";
import type { Company, CompanySummary } from "@/lib/data/rh";

type Props = {
  company: Company;
  summary: CompanySummary;
  canEdit: boolean;
};

const categoryLabels = {
  admin: "Admin",
  fund1: "Fund. I",
  fund2: "Fund. II",
  medio: "Médio"
} as const;

export function CompanyCard({ company, summary, canEdit }: Props) {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ui bg-brand/10 text-brand">
            <Building2 size={18} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-ink truncate" title={company.name}>{company.name}</h3>
            <p className="text-xs text-ink/60 font-medium tabular-nums">{company.cnpj}</p>
          </div>
        </div>
        <StatusPill tone={company.ativo ? "success" : "danger"}>
          {company.ativo ? "Ativa" : "Inativa"}
        </StatusPill>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 border-y border-line py-3">
        <div>
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.10em] text-ink/60">Funcionários</p>
          <strong className="mt-1 block text-lg font-bold text-ink tabular-nums">{summary.totalFuncionarios}</strong>
        </div>
        {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((cat) => (
          <div key={cat}>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.10em] text-ink/60">{categoryLabels[cat]}</p>
            <strong className="mt-1 block text-lg font-bold text-ink/80 tabular-nums">{summary.porCategoria[cat]}</strong>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href={`/rh/empresas/${company.id}`} className="text-sm font-semibold text-brand hover:underline">
          Ver funcionários →
        </Link>
        {canEdit ? (
          <div className="flex items-center gap-3">
            <Link href={`/rh/empresas/${company.id}/editar`} className="text-xs font-semibold text-ink/65 hover:text-brand">
              Editar
            </Link>
            <form action={toggleCompanyAction} className="inline">
              <input type="hidden" name="id" value={company.id} />
              <input type="hidden" name="ativo" value={company.ativo ? "" : "on"} />
              <button type="submit" className="text-xs font-semibold text-danger hover:underline">
                {company.ativo ? "Desativar" : "Ativar"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
