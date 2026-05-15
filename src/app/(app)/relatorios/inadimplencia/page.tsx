import { ExportDelinquencyButton } from "@/components/pdf/export-delinquency-button";
import { Badge } from "@/components/ui/badge";
import { Card, Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { getDelinquencyReport } from "@/lib/data/finance";

function dateText(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function InadimplenciaPage() {
  const report = await getDelinquencyReport();

  const summary = [
    ["Total vencido", money.format(report.total)],
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
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Inadimplencia
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Cobrancas vencidas ou em aberto agrupadas por aluno.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ExportDelinquencyButton rows={report.rows} />
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
            <p className="text-sm text-ink/65">Nenhuma cobranca vencida em aberto.</p>
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
                return (
                  <tr key={item.id} className="border-t border-line transition hover:bg-muted/60">
                    <td className="px-5 py-4 font-black text-ink">{aluno?.nome}</td>
                    <td className="px-5 py-4 text-ink/70">{item.descricao}</td>
                    <td className="px-5 py-4 text-ink/70">{item.competencia}</td>
                    <td className="px-5 py-4 text-ink/70">{dateText(item.data_vencimento)}</td>
                    <td className="px-5 py-4"><Badge tone="red">{item.status}</Badge></td>
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
