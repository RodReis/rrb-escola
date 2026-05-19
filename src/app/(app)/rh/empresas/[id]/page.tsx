import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { getCompanyById, getCompanySummary, listEmployees } from "@/lib/data/rh";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const contratoTone: Record<string, StatusTone> = {
  CLT: "success",
  PJ: "neutral",
  Estagio: "warning",
  Temporario: "danger"
};

const categoryLabels: Record<string, string> = {
  admin: "Admin",
  fund1: "Fund. I",
  fund2: "Fund. II",
  medio: "Médio"
};

export default async function EmpresaDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("rh.empresas", "read");
  const { id } = await params;
  const canMutate = session.profile.perfil === "admin" || session.profile.perfil === "secretaria";

  const company = await getCompanyById(id);
  if (!company) notFound();

  const [summary, employees] = await Promise.all([
    getCompanySummary(id),
    listEmployees({ companyId: id })
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Empresas", href: "/rh/empresas" },
          { label: company.name }
        ]}
        title={company.name}
        counter={company.cnpj}
        description="Funcionários vinculados a esta empresa."
        actions={
          canMutate ? (
            <ButtonLink href={`/rh/funcionarios/novo?company=${company.id}`} variant="primary">
              <Plus size={14} /> Adicionar funcionário
            </ButtonLink>
          ) : null
        }
        kpis={[
          { label: "Funcionários", value: summary.totalFuncionarios.toLocaleString("pt-BR") },
          { label: "Ativos",       value: summary.ativos.toLocaleString("pt-BR"), tone: "success" },
          { label: "Inativos",     value: summary.inativos.toLocaleString("pt-BR"), tone: "danger" },
          { label: "Admin",        value: summary.porCategoria.admin.toLocaleString("pt-BR") },
          { label: "Docentes",     value: (summary.porCategoria.fund1 + summary.porCategoria.fund2 + summary.porCategoria.medio).toLocaleString("pt-BR") }
        ]}
      />

      <DataTableShell>
        <table className="ds-dt min-w-[860px]">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Categoria</th>
              <th>Cargo</th>
              <th>Contato</th>
              <th>Contrato</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-ink/50 py-10">
                  Nenhum funcionário vinculado a esta empresa.
                </td>
              </tr>
            ) : null}
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  <Link
                    href={canMutate ? `/rh/funcionarios/${emp.id}/editar` : `#`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar name={emp.name} size={32} />
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold text-ink group-hover:text-brand">{emp.name}</span>
                      <span className="text-xs text-ink/50 tabular-nums">{emp.cpf}</span>
                    </span>
                  </Link>
                </td>
                <td className="text-ink/80">
                  {emp.school_category ? categoryLabels[emp.school_category] ?? emp.school_category : "—"}
                </td>
                <td className="text-ink/80">{emp.cargo ?? "—"}</td>
                <td>
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm text-ink/80">{emp.email ?? "—"}</span>
                    <span className="text-xs text-ink/55">{emp.telefone ?? "—"}</span>
                  </span>
                </td>
                <td>
                  {emp.status_contrato ? (
                    <StatusPill tone={contratoTone[emp.status_contrato] ?? "neutral"}>
                      {emp.status_contrato}
                    </StatusPill>
                  ) : (
                    <span className="text-ink/40">—</span>
                  )}
                </td>
                <td>
                  <StatusPill tone={emp.ativo ? "success" : "danger"}>
                    {emp.ativo ? "Ativo" : "Inativo"}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
