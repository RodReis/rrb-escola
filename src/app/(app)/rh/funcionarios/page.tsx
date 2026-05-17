import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { EmployeeFilters } from "@/components/rh/employee-filters";
import { DeleteEmployeeButton } from "@/components/rh/delete-employee-button";
import { ToggleEmployeeButton } from "@/components/rh/toggle-employee-button";
import { listCompanies, listEmployees, getEmployeeSegmentCounts } from "@/lib/data/rh";
import { requireSession } from "@/lib/auth/session";

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

export default async function FuncionariosPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string; segmento?: string; empresa?: string; contrato?: string; inativos?: string; ok?: string; erro?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const isAdmin = session.profile.perfil === "admin";
  const canMutate = isAdmin || session.profile.perfil === "secretaria";

  const filters = {
    search: params.search || undefined,
    segmento: params.segmento || undefined,
    companyId: params.empresa || undefined,
    statusContrato: params.contrato || undefined,
    includeInactive: isAdmin && params.inativos === "1"
  };

  const [employees, companies, counts] = await Promise.all([
    listEmployees(filters),
    listCompanies({ includeInactive: true }),
    getEmployeeSegmentCounts(filters)
  ]);

  const ativos = employees.filter((e) => e.ativo).length;
  const docentes = employees.filter((e) => e.school_category && e.school_category !== "admin").length;
  const adminCount = employees.filter((e) => e.school_category === "admin").length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Funcionários" }]}
        title="Funcionários"
        counter={employees.length.toLocaleString("pt-BR")}
        description="Cadastro completo dos funcionários vinculados às empresas da escola."
        actions={
          canMutate ? (
            <ButtonLink href="/rh/funcionarios/novo" variant="primary">
              <Plus size={14} /> Novo funcionário
            </ButtonLink>
          ) : null
        }
        kpis={[
          { label: "Total",    value: employees.length.toLocaleString("pt-BR") },
          { label: "Ativos",   value: ativos.toLocaleString("pt-BR"), tone: "success" },
          { label: "Admin",    value: adminCount.toLocaleString("pt-BR") },
          { label: "Docentes", value: docentes.toLocaleString("pt-BR") }
        ]}
      />

      {params.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Funcionário {params.ok} com sucesso.
        </div>
      ) : null}
      {params.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{params.erro}</div>
      ) : null}

      <DataTableShell
        toolbar={
          <EmployeeFilters companies={companies} counts={counts} canViewInactive={isAdmin} />
        }
        footer={
          <span>
            Mostrando <strong className="text-ink">{employees.length}</strong> funcionário(s)
          </span>
        }
      >
        <table className="ds-dt min-w-[1100px]">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Empresa</th>
              <th>Categoria</th>
              <th>Cargo</th>
              <th>Contato</th>
              <th>Contrato</th>
              <th>Status</th>
              {canMutate ? <th className="text-right">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={canMutate ? 8 : 7} className="text-center text-ink/50 py-10">
                  Nenhum funcionário encontrado.
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
                <td className="text-ink/80">{emp.companies?.name ?? "—"}</td>
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
                {canMutate ? (
                  <td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      <Link
                        href={`/rh/funcionarios/${emp.id}/editar`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        title="Editar"
                      >
                        <Pencil size={14} /> Editar
                      </Link>
                      <ToggleEmployeeButton id={emp.id} name={emp.name} ativo={emp.ativo} />
                      {isAdmin ? <DeleteEmployeeButton id={emp.id} name={emp.name} /> : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
