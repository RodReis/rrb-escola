import { DelinquencyFilters } from "@/components/finance/delinquency-filters";
import { ExportDelinquencyButton } from "@/components/pdf/export-delinquency-button";
import { Badge } from "@/components/ui/badge";
import { Card, Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { getDelinquencyReport, type DelinquencyFilters as Filters } from "@/lib/data/finance";

export const dynamic = "force-dynamic";

function dateText(value: string | null | undefined) {
  if (!value) return "-";
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
  const filters = parseFilters(searchParams);
  const report = await getDelinquencyReport(filters);

  const summary = [
    ["Total no filtro", money.format(report.total)],
    ["Cobrancas", String(report.rows.length)],
    ["Alunos", String(report.byStudent.length)],
    ["Data base", dateText(report.date)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Relatorios</span>
              <span className="text-line">/</span>
              <span className="text-brand">Inadimplencia</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">Inadimplencia</h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Cobrancas por periodo, status e aluno.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <ExportDelinquencyButton rows={report.rows} filters={filters} />
          </div>
        </div>
      </section>

      <DelinquencyFilters defaults={{ de: filters.de, ate: filters.ate, statuses: filters.statuses, aluno: filters.aluno ?? "" }} />

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl font-black text-ink">{value}</strong>
          </Card>
        ))}
      </section>

      <Panel className="grid gap-4">
        <h2 className="text-lg font-black text-ink">Resumo por aluno</h2>
        <div className="grid gap-2">
          {report.byStudent.length === 0 ? (
            <p className="text-sm text-ink/65">Nenhuma cobranca no filtro selecionado.</p>
          ) : (
            report.byStudent.map((item) => (
              <div key={`${item.matricula}-${item.aluno}`} className="grid gap-2 rounded-ui border border-line p-3 text-sm md:grid-cols-[1fr_150px_100px]">
                <strong className="text-ink">{item.aluno}</strong>
                <span className="font-black text-brand">{money.format(item.total)}</span>
                <span className="text-ink/65">{item.quantidade} itens</span>
              </div>
            ))
          )}
        </div>
      </Panel>

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-muted text-xs font-black uppercase tracking-[0.1em] text-ink/62">
              <tr>
                <th className="px-5 py-3">Aluno</th>
                <th className="px-5 py-3">Descricao</th>
                <th className="px-5 py-3">Competencia</th>
                <th className="px-5 py-3">Vencimento</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((item) => {
                const aluno = Array.isArray(item.alunos) ? item.alunos[0] : item.alunos;
                const isVencida = item.data_vencimento < report.date;
                const display = isVencida ? "vencida" : item.status;
                const tone = display === "vencida" ? "red" : display === "parcial" ? "gold" : "gray";
                return (
                  <tr key={item.id} className="border-t border-line transition hover:bg-muted/60">
                    <td className="px-5 py-4 font-black text-ink">{aluno?.nome}</td>
                    <td className="px-5 py-4 text-ink/70">{item.descricao}</td>
                    <td className="px-5 py-4 text-ink/70">{item.competencia}</td>
                    <td className="px-5 py-4 text-ink/70">{dateText(item.data_vencimento)}</td>
                    <td className="px-5 py-4"><Badge tone={tone}>{display}</Badge></td>
                    <td className="px-5 py-4 font-black text-brand">{money.format(Number(item.valor_final))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
