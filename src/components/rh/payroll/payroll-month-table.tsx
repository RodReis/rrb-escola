import Link from "next/link";
import { FileText } from "lucide-react";
import { DataTableShell } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";
import type { PayrollRowJoined } from "@/lib/data/payroll";

export function PayrollMonthTable({
  rows,
  mes,
  canEdit
}: {
  rows: PayrollRowJoined[];
  mes: string;
  canEdit: boolean;
}) {
  return (
    <DataTableShell
      footer={
        <span>
          Mostrando <strong className="text-ink">{rows.length}</strong> funcionário(s)
        </span>
      }
    >
      <table className="ds-dt min-w-[1200px]">
        <thead>
          <tr>
            <th>Funcionário</th>
            <th>Empresa</th>
            <th className="text-right">Base</th>
            <th className="text-right">Proventos</th>
            <th className="text-right">INSS</th>
            <th className="text-right">IR</th>
            <th className="text-right">Descontos</th>
            <th className="text-right">Líquido</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center text-ink/50 py-10">
                Nenhum lançamento no mês.
              </td>
            </tr>
          ) : null}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link
                  href={`/financeiro/folha/${mes}/${r.employee_id}`}
                  className="flex items-center gap-3 group"
                >
                  <Avatar name={r.employees?.name ?? "?"} size={32} />
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold text-ink group-hover:text-brand">
                      {r.employees?.name ?? "—"}
                      {r.employees && !r.employees.ativo ? (
                        <StatusPill tone="danger" className="ml-2">Inativo</StatusPill>
                      ) : null}
                    </span>
                    <span className="text-xs text-ink/50 tabular-nums">{r.employees?.cpf ?? ""}</span>
                  </span>
                </Link>
              </td>
              <td className="text-ink/80">{r.employees?.companies?.name ?? "—"}</td>
              <td className="text-right tabular-nums">{money.format(Number(r.base_salary) > 0 ? Number(r.base_salary) : Number(r.employees?.base_salary ?? 0))}</td>
              <td className="text-right tabular-nums text-success">{money.format(Number(r.total_earnings) > 0 ? Number(r.total_earnings) : Number(r.employees?.base_salary ?? 0))}</td>
              <td className="text-right tabular-nums text-danger">{money.format(Number(r.inss ?? 0))}</td>
              <td className="text-right tabular-nums text-danger">{money.format(Number(r.ir ?? 0))}</td>
              <td className="text-right tabular-nums text-warning">{money.format(Number(r.total_deductions ?? 0))}</td>
              <td className="text-right font-bold text-brand tabular-nums">{money.format(Number(r.net_amount ?? 0))}</td>
              <td className="text-right">
                <Link
                  href={`/financeiro/folha/${mes}/${r.employee_id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  <FileText size={12} /> {canEdit ? "Editar" : "Ver"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
