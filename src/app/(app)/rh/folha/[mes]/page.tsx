import { notFound } from "next/navigation";
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
import { isValidUrlMonth, urlToDbMonth, monthLabel } from "@/lib/payroll/date-utils";
import {
  listPayrollByMonth,
  getPayrollPeriod,
  getMonthSummary,
  listEmployeesNeedingPayroll
} from "@/lib/data/payroll";

export const dynamic = "force-dynamic";

export default async function FolhaMesPage({
  params,
  searchParams
}: {
  params: Promise<{ mes: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const session = await requirePermission("rh.folha", "read");
  const { mes } = await params;
  const sp = await searchParams;

  if (!isValidUrlMonth(mes)) notFound();
  const dbMonth = urlToDbMonth(mes);
  const isAdmin = session.profile.perfil === "admin";

  const [rows, period, summary, needing] = await Promise.all([
    listPayrollByMonth(dbMonth),
    getPayrollPeriod(dbMonth),
    getMonthSummary(dbMonth),
    listEmployeesNeedingPayroll(dbMonth)
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
            <GenerateMonthButton mes={mes} hasPayrolls={rows.length > 0} />
            {isAdmin ? <ClosePeriodButton mes={mes} status={period.status} /> : null}
            <ExportMonthButtons rows={rows} mes={mes} />
          </div>
        }
      />

      {sp.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Operação <strong>{sp.ok}</strong> concluída.
        </div>
      ) : null}
      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      {fechado ? (
        <div className="rounded-ui bg-warning/10 border border-warning/30 p-3 text-sm font-semibold text-warning">
          Mês fechado em {period.closed_at ? new Date(period.closed_at).toLocaleString("pt-BR") : "—"}. Edições bloqueadas.
        </div>
      ) : null}

      {needing.length > 0 && rows.length > 0 ? (
        <div className="rounded-ui bg-brand/10 p-3 text-sm font-semibold text-brand flex items-center justify-between gap-3">
          <span>{needing.length} funcionário(s) ativo(s) sem lançamento neste mês.</span>
          <GenerateMonthButton mes={mes} hasPayrolls={true} />
        </div>
      ) : null}

      <PayrollSummaryCard summary={summary} />

      <Panel className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink/70">Status do período:</span>
          <StatusPill tone={fechado ? "danger" : "success"}>{fechado ? "Fechado" : "Aberto"}</StatusPill>
        </div>
        <ButtonLink href="/rh/brackets" variant="secondary">Brackets</ButtonLink>
      </Panel>

      {rows.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-10 text-center">
          <p className="text-sm font-medium text-ink/65">Folha de {monthLabel(mes)} ainda não foi gerada.</p>
          <div className="mt-4 inline-block">
            <GenerateMonthButton mes={mes} hasPayrolls={false} />
          </div>
        </div>
      ) : (
        <PayrollMonthTable rows={rows} mes={mes} canEdit={!fechado} />
      )}
    </div>
  );
}
