import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyCard } from "@/components/rh/company-card";
import { listCompanies, getCompanySummary } from "@/lib/data/rh";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EmpresasPage({
  searchParams
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const isAdmin = session.profile.perfil === "admin";

  const companies = await listCompanies({ includeInactive: isAdmin });
  const summaries = await Promise.all(companies.map((c) => getCompanySummary(c.id)));

  const totalFuncionarios = summaries.reduce((s, x) => s + x.totalFuncionarios, 0);
  const totalAtivos = summaries.reduce((s, x) => s + x.ativos, 0);
  const totalInativos = summaries.reduce((s, x) => s + x.inativos, 0);
  const ativas = companies.filter((c) => c.ativo).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Empresas" }]}
        title="Empresas"
        counter={companies.length.toLocaleString("pt-BR")}
        description="Cadastro de pessoas jurídicas para vinculação de funcionários."
        actions={
          isAdmin ? (
            <ButtonLink href="/rh/empresas/nova" variant="primary">
              <Plus size={14} /> Nova empresa
            </ButtonLink>
          ) : null
        }
        kpis={[
          { label: "Total",         value: companies.length.toLocaleString("pt-BR") },
          { label: "Ativas",        value: ativas.toLocaleString("pt-BR"), tone: "success" },
          { label: "Funcionários",  value: totalFuncionarios.toLocaleString("pt-BR") },
          { label: "Ativos",        value: totalAtivos.toLocaleString("pt-BR"), tone: "success" },
          { label: "Inativos",      value: totalInativos.toLocaleString("pt-BR"), tone: "danger" }
        ]}
      />

      {params.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Empresa {params.ok} com sucesso.
        </div>
      ) : null}
      {params.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{params.erro}</div>
      ) : null}

      {companies.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-10 text-center">
          <p className="text-sm font-medium text-ink/65">Nenhuma empresa cadastrada.</p>
          {isAdmin ? (
            <ButtonLink href="/rh/empresas/nova" variant="primary" className="mt-4">
              <Plus size={14} /> Cadastrar primeira empresa
            </ButtonLink>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((company, i) => (
            <CompanyCard
              key={company.id}
              company={company}
              summary={summaries[i]!}
              canEdit={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
