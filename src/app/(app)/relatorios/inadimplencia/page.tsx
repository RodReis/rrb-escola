import { Users, Receipt } from "lucide-react";
import { DelinquencyFilters } from "@/components/finance/delinquency-filters";
import { ExportDelinquencyButton } from "@/components/pdf/export-delinquency-button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";
import { getDelinquencyReport, type DelinquencyFilters as Filters } from "@/lib/data/finance";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function dateText(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function parseFilters(sp: { de?: string; ate?: string; status?: string | string[]; aluno?: string }): Filters {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const statusParam = sp.status;
  const statuses = Array.isArray(statusParam) ? statusParam : statusParam ? [statusParam] : ["parcial", "vencida"];
  return {
    de: sp.de || thirtyAgo,
    ate: sp.ate || today,
    statuses,
    aluno: sp.aluno?.trim() || null
  };
}

export default async function InadimplenciaPage({ searchParams }: { searchParams: { de?: string; ate?: string; status?: string | string[]; aluno?: string } }) {
  await requirePermission("relatorios", "read");
  const filters = parseFilters(searchParams);
  const report = await getDelinquencyReport(filters);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/" }, { label: "Inadimplência" }]}
        title="Inadimplência"
        counter={dateText(report.date)}
        description="Cobranças por período, status e aluno."
        actions={<ExportDelinquencyButton rows={report.rows} filters={filters} />}
        kpis={[
          { label: "Total",     value: money.format(report.total), tone: "danger" },
          { label: "Cobranças", value: report.rows.length.toLocaleString("pt-BR") },
          { label: "Alunos",    value: report.byStudent.length.toLocaleString("pt-BR") },
          { label: "Data base", value: dateText(report.date) }
        ]}
      />

      <DelinquencyFilters defaults={{ de: filters.de, ate: filters.ate, statuses: filters.statuses, aluno: filters.aluno ?? "" }} />

      <Panel className="grid gap-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Users size={18} className="text-brand" /> Resumo por aluno
        </h2>
        <div className="grid gap-2">
          {report.byStudent.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
              <Receipt size={28} />
              <p className="text-sm font-medium">Nenhuma cobrança no filtro selecionado.</p>
            </div>
          ) : (
            report.byStudent.map((item) => (
              <div key={`${item.matricula}-${item.aluno}`} className="grid gap-2 rounded-ui border border-line p-3 text-sm md:grid-cols-[1fr_150px_100px]">
                <strong className="text-ink">{item.aluno}</strong>
                <span className="font-bold text-brand">{money.format(item.total)}</span>
                <span className="text-ink/60">{item.quantidade} itens</span>
              </div>
            ))
          )}
        </div>
      </Panel>

      <DataTableShell>
        <table className="ds-dt min-w-[880px]">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Descrição</th>
              <th>Competência</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((item) => {
              const aluno = Array.isArray(item.alunos) ? item.alunos[0] : item.alunos;
              const isVencida = item.data_vencimento < report.date;
              const display = isVencida ? "vencida" : item.status;
              const tone: StatusTone = display === "vencida" ? "danger" : display === "parcial" ? "warning" : "neutral";
              return (
                <tr key={item.id}>
                  <td className="font-semibold text-ink">{aluno?.nome}</td>
                  <td className="text-ink/75">{item.descricao}</td>
                  <td className="text-ink/75">{item.competencia}</td>
                  <td className="text-ink/75">{dateText(item.data_vencimento)}</td>
                  <td><StatusPill tone={tone}>{display}</StatusPill></td>
                  <td className="font-semibold text-brand">{money.format(Number(item.valor_final))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
