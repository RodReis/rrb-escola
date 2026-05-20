import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, Lock, Calculator } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { MonthNav } from "@/components/rh/payroll/month-nav";
import { GenerateMonthButton } from "@/components/rh/payroll/generate-month-button";
import { ClosePeriodButton } from "@/components/rh/payroll/close-period-button";
import { PayrollMonthTable } from "@/components/rh/payroll/payroll-month-table";
import { PayrollSummaryCard } from "@/components/rh/payroll/payroll-summary-card";
import { ExportMonthButtons } from "@/components/rh/payroll/export-month-buttons";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { isValidUrlMonth, urlToDbMonth, monthLabel } from "@/lib/payroll/date-utils";
import {
  listPayrollByMonth,
  getPayrollPeriod,
  getMonthSummary,
  listEmployeesNeedingPayroll,
  listCompanies
} from "@/lib/data/payroll";
import { PayrollFilters } from "@/components/rh/payroll/payroll-filters";

export const dynamic = "force-dynamic";

export default async function FolhaMesPage({
  params,
  searchParams
}: {
  params: Promise<{ mes: string }>;
  searchParams: Promise<{ ok?: string; erro?: string; search?: string; companyId?: string }>;
}) {
  const session = await requirePermission("rh.folha", "read");
  const { mes } = await params;
  const sp = await searchParams;

  if (!isValidUrlMonth(mes)) notFound();
  const dbMonth = urlToDbMonth(mes);
  const isAdmin = session.profile.perfil === "admin";
  const canUpdate = isAdmin || can(session.permissions, "rh.folha", "update");

  const [rows, period, summary, needing, companies] = await Promise.all([
    listPayrollByMonth(dbMonth, { search: sp.search, companyId: sp.companyId }),
    getPayrollPeriod(dbMonth),
    getMonthSummary(dbMonth),
    listEmployeesNeedingPayroll(dbMonth),
    listCompanies()
  ]);

  const fechado = period.status === "fechado";

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Folha" }, { label: monthLabel(mes) }]}
        title="Folha de pagamento"
        counter={monthLabel(mes)}
        description="Lançamentos da competência. Salário base, proventos, descontos e líquido por funcionário."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthNav mes={mes} />
            <span className="mx-1 h-5 w-px bg-line" />
            {canUpdate ? <GenerateMonthButton mes={mes} hasPayrolls={rows.length > 0} /> : null}
            {canUpdate ? <ClosePeriodButton mes={mes} status={period.status} /> : null}
            <ExportMonthButtons rows={rows} mes={mes} />
          </div>
        }
      />

      {sp.ok ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} />
          Operação <strong>{sp.ok}</strong> concluída.
        </div>
      ) : null}
      {sp.erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {sp.erro}
        </div>
      ) : null}

      {fechado ? (
        <div className="flex items-center gap-2 rounded-ui bg-warning/10 border border-warning/30 p-3 text-sm font-semibold text-warning">
          <Lock size={16} />
          Mês fechado em {period.closed_at ? new Date(period.closed_at).toLocaleString("pt-BR") : "—"}. Edições bloqueadas.
        </div>
      ) : null}

      {needing.length > 0 && rows.length > 0 && canUpdate ? (
        <div className="rounded-ui bg-brand/10 p-3 text-sm font-semibold text-brand flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {needing.length} funcionário(s) ativo(s) sem lançamento neste mês.
          </span>
          <GenerateMonthButton mes={mes} hasPayrolls={true} />
        </div>
      ) : null}

      <PayrollSummaryCard summary={summary} />

      <Panel className="flex items-center gap-3 p-3">
        <span className="text-sm font-semibold text-ink/70">Status do período:</span>
        <StatusPill tone={fechado ? "danger" : "success"}>{fechado ? "Fechado" : "Aberto"}</StatusPill>
        <div className="w-px self-stretch bg-line mx-1" />
        <PayrollFilters companies={companies} />
        <ButtonLink href="/rh/brackets" variant="secondary" className="shrink-0">Brackets</ButtonLink>
      </Panel>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-panel border border-line bg-surface py-14 text-ink/40">
          <Calculator size={32} />
          <p className="text-sm font-medium">Folha de {monthLabel(mes)} ainda não foi gerada.</p>
          {canUpdate ? (
            <div className="mt-3">
              <GenerateMonthButton mes={mes} hasPayrolls={false} />
            </div>
          ) : null}
        </div>
      ) : (
        <PayrollMonthTable rows={rows} mes={mes} canEdit={!fechado && canUpdate} />
      )}
    </div>
  );
}
