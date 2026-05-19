import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PayrollRowForm } from "@/components/rh/payroll/payroll-row-form";
import { HoleritePdfButton } from "@/components/rh/payroll/holerite-pdf-button";
import { requirePermission } from "@/lib/auth/session";
import { isValidUrlMonth, urlToDbMonth, monthLabel } from "@/lib/payroll/date-utils";
import { getPayrollByEmployeeMonth, getPayrollPeriod } from "@/lib/data/payroll";
import { getBracketsForMonth } from "@/lib/data/brackets";

export const dynamic = "force-dynamic";

export default async function FolhaEmployeeMonthPage({
  params,
  searchParams
}: {
  params: Promise<{ mes: string; employee_id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  await requirePermission("rh.folha", "read");
  const { mes, employee_id } = await params;
  const sp = await searchParams;

  if (!isValidUrlMonth(mes)) notFound();
  const dbMonth = urlToDbMonth(mes);

  const [row, period, brackets] = await Promise.all([
    getPayrollByEmployeeMonth(employee_id, dbMonth),
    getPayrollPeriod(dbMonth),
    getBracketsForMonth(dbMonth)
  ]);

  if (!row) notFound();

  const disabled = period.status === "fechado";
  const emp = row.employees;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Folha", href: "/rh/folha" },
          { label: monthLabel(mes), href: `/rh/folha/${mes}` },
          { label: emp?.name ?? "—" }
        ]}
        title={emp?.name ?? "—"}
        counter={monthLabel(mes)}
        description={`${emp?.companies?.name ?? "—"} • ${emp?.cargo ?? "—"} • ${emp?.school_category ?? "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HoleritePdfButton row={row} mes={mes} />
            <ButtonLink href={`/rh/folha/${mes}`} variant="secondary">
              <ArrowLeft size={14} /> Voltar
            </ButtonLink>
          </div>
        }
      />

      {sp.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Lançamento salvo.
        </div>
      ) : null}
      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      {disabled ? (
        <div className="rounded-ui bg-warning/10 border border-warning/30 p-3 text-sm font-semibold text-warning">
          Mês fechado. Reabra para editar.
        </div>
      ) : null}

      {brackets.inss.length === 0 || brackets.ir.length === 0 ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          Brackets INSS/IR não configurados para esta competência. Acesse <strong>/rh/brackets</strong> para cadastrar.
        </div>
      ) : null}

      <PayrollRowForm row={row} brackets={brackets} disabled={disabled} />
    </div>
  );
}
