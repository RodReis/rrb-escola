import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { EmployeeForm } from "@/components/rh/employee-form";
import { updateEmployeeAction } from "@/lib/actions/rh";
import { listCompanies, getEmployeeById } from "@/lib/data/rh";
import { requirePermission } from "@/lib/auth/session";

export default async function EditarFuncionarioPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("rh.funcionarios", "update");
  const { id } = await params;
  const sp = await searchParams;

  const [employee, companies] = await Promise.all([
    getEmployeeById(id),
    listCompanies({ includeInactive: true })
  ]);

  if (!employee) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Funcionários", href: "/rh/funcionarios" },
          { label: employee.name }
        ]}
        title="Editar funcionário"
        counter={employee.cpf}
      />

      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      <Panel className="p-6">
        <EmployeeForm
          action={updateEmployeeAction}
          employee={employee}
          companies={companies}
          submitLabel="Salvar alterações"
        />
      </Panel>
    </div>
  );
}
