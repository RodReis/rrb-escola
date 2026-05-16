import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { EmployeeForm } from "@/components/rh/employee-form";
import { createEmployeeAction } from "@/lib/actions/rh";
import { listCompanies } from "@/lib/data/rh";
import { requirePerfil } from "@/lib/auth/session";

export default async function NovoFuncionarioPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string; company?: string }>;
}) {
  await requirePerfil(["admin", "secretaria"]);
  const params = await searchParams;
  const companies = await listCompanies({ includeInactive: false });

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Funcionários", href: "/rh/funcionarios" }, { label: "Novo" }]}
        title="Novo funcionário"
        description="Vincule um funcionário a uma empresa."
      />

      {params.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{params.erro}</div>
      ) : null}

      <Panel className="p-6">
        <EmployeeForm
          action={createEmployeeAction}
          companies={companies}
          defaultCompanyId={params.company}
          submitLabel="Cadastrar funcionário"
        />
      </Panel>
    </div>
  );
}
