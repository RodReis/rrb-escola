import { ExportAttendanceButton } from "@/components/pdf/export-attendance-button";
import { Card, Panel } from "@/components/ui/card";
import { getAttendanceReport } from "@/lib/data/attendance";

type SearchParams = {
  inicio?: string;
  fim?: string;
};

function dateText(value: string) {
  return value.split("-").reverse().join("/");
}

export default async function RelatorioFrequenciaPage({ searchParams }: { searchParams: SearchParams }) {
  const report = await getAttendanceReport(searchParams.inicio, searchParams.fim);

  const summary = [
    ["Registros", String(report.totals.registros)],
    ["Presencas", String(report.totals.presencas)],
    ["Faltas", String(report.totals.faltas)],
    ["Periodo", `${dateText(report.start)} - ${dateText(report.end)}`]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Relatorios</span>
              <span className="text-line">/</span>
              <span className="text-brand">Frequencia</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Relatorio de frequencia
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Consolidado de presencas, faltas e percentual por aluno.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ExportAttendanceButton rows={report.summary} start={report.start} end={report.end} />
            </div>
            <dl className="grid gap-0 sm:grid-cols-4">
              {summary.map(([label, value]) => (
                <div key={label} className="border-line py-1 sm:border-l sm:px-6 first:sm:border-l-0">
                  <dt className="text-xs font-medium text-ink/62">{label}</dt>
                  <dd className="mt-1 font-serif text-2xl italic leading-none text-brand">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <Panel>
        <form action="/relatorios/frequencia" className="grid gap-4 md:grid-cols-[220px_220px_140px]">
          <label>
            Inicio
            <input name="inicio" type="date" defaultValue={report.start} />
          </label>
          <label>
            Fim
            <input name="fim" type="date" defaultValue={report.end} />
          </label>
          <button className="ds-button ds-button-primary self-end">Filtrar</button>
        </form>
      </Panel>

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl font-black text-ink">{value}</strong>
          </Card>
        ))}
      </section>

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-muted text-xs font-black uppercase tracking-[0.1em] text-ink/62">
              <tr>
                <th className="px-5 py-3">Matricula</th>
                <th className="px-5 py-3">Aluno</th>
                <th className="px-5 py-3">Presencas</th>
                <th className="px-5 py-3">Faltas</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">% Presenca</th>
              </tr>
            </thead>
            <tbody>
              {report.summary.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-ink/65" colSpan={6}>
                    Nenhum registro de frequencia no periodo.
                  </td>
                </tr>
              ) : (
                report.summary.map((item) => (
                  <tr key={`${item.matricula}-${item.aluno}`} className="border-t border-line transition hover:bg-muted/60">
                    <td className="px-5 py-4 font-black text-brand">{item.matricula}</td>
                    <td className="px-5 py-4 font-black text-ink">{item.aluno}</td>
                    <td className="px-5 py-4 text-ink/70">{item.presencas}</td>
                    <td className="px-5 py-4 text-ink/70">{item.faltas}</td>
                    <td className="px-5 py-4 text-ink/70">{item.total}</td>
                    <td className="px-5 py-4 font-black text-brand">{item.percentual}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
