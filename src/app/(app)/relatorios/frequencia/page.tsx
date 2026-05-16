import { ExportAttendanceButton } from "@/components/pdf/export-attendance-button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { getAttendanceReport } from "@/lib/data/attendance";

type SearchParams = { inicio?: string; fim?: string };

function dateText(value: string) {
  return value.split("-").reverse().join("/");
}

export default async function RelatorioFrequenciaPage({ searchParams }: { searchParams: SearchParams }) {
  const report = await getAttendanceReport(searchParams.inicio, searchParams.fim);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/" }, { label: "Frequência" }]}
        title="Relatório de Frequência"
        counter={`${dateText(report.start)} – ${dateText(report.end)}`}
        description="Consolidado de presenças, faltas e percentual por aluno."
        actions={<ExportAttendanceButton rows={report.summary} start={report.start} end={report.end} />}
        kpis={[
          { label: "Registros", value: report.totals.registros.toLocaleString("pt-BR") },
          { label: "Presenças", value: report.totals.presencas.toLocaleString("pt-BR"), tone: "success" },
          { label: "Faltas",    value: report.totals.faltas.toLocaleString("pt-BR"), tone: "danger" }
        ]}
      />

      <Panel>
        <form action="/relatorios/frequencia" className="grid gap-4 md:grid-cols-[220px_220px_140px]">
          <label>Início<input name="inicio" type="date" defaultValue={report.start} /></label>
          <label>Fim<input name="fim" type="date" defaultValue={report.end} /></label>
          <button className="ds-button ds-button-primary self-end">Filtrar</button>
        </form>
      </Panel>

      <DataTableShell>
        <table className="ds-dt min-w-[780px]">
          <thead>
            <tr>
              <th>Matrícula</th>
              <th>Aluno</th>
              <th>Presenças</th>
              <th>Faltas</th>
              <th>Total</th>
              <th>% Presença</th>
            </tr>
          </thead>
          <tbody>
            {report.summary.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-ink/55 py-10">Nenhum registro de frequência no período.</td></tr>
            ) : (
              report.summary.map((item) => (
                <tr key={`${item.matricula}-${item.aluno}`}>
                  <td className="font-semibold text-brand">{item.matricula}</td>
                  <td className="font-semibold text-ink">{item.aluno}</td>
                  <td className="text-ink/75">{item.presencas}</td>
                  <td className="text-ink/75">{item.faltas}</td>
                  <td className="text-ink/75">{item.total}</td>
                  <td className="font-semibold text-brand">{item.percentual}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
