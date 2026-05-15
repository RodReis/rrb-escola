import Link from "next/link";
import { Eye } from "lucide-react";
import { ExportStudentsReportButton } from "@/components/pdf/export-students-report-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getStudentsReport } from "@/lib/data/students";

export default async function RelatorioAlunosPage() {
  const rows = await getStudentsReport();
  const ativos = rows.filter((item) => item.ativo).length;
  const inativos = rows.length - ativos;
  const matriculados = rows.filter((item) => item.statusMatricula === "ativa").length;

  const summary = [
    ["Total", String(rows.length)],
    ["Ativos", String(ativos)],
    ["Inativos", String(inativos)],
    ["Matriculados", String(matriculados)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Relatorios</span>
              <span className="text-line">/</span>
              <span className="text-brand">Alunos</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Relatorio de alunos
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Visao consolidada de alunos, responsaveis, serie, turma e status.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ExportStudentsReportButton rows={rows} />
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

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-muted text-xs font-black uppercase tracking-[0.1em] text-ink/62">
              <tr>
                <th className="px-5 py-3">Matricula</th>
                <th className="px-5 py-3">Aluno</th>
                <th className="px-5 py-3">CPF</th>
                <th className="px-5 py-3">Responsavel</th>
                <th className="px-5 py-3">Serie</th>
                <th className="px-5 py-3">Turma</th>
                <th className="px-5 py-3">Ano</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-line transition hover:bg-muted/60">
                  <td className="px-5 py-4 font-black text-brand">{item.matricula}</td>
                  <td className="px-5 py-4 font-black text-ink">{item.nome}</td>
                  <td className="px-5 py-4 text-ink/70">{item.cpf || "-"}</td>
                  <td className="px-5 py-4 text-ink/70">{item.responsavel || "-"}</td>
                  <td className="px-5 py-4 text-ink/70">{item.serie || "-"}</td>
                  <td className="px-5 py-4 text-ink/70">{item.turma || "-"}</td>
                  <td className="px-5 py-4 text-ink/70">{item.anoLetivo || "-"}</td>
                  <td className="px-5 py-4">
                    <Badge tone={item.ativo ? "green" : "red"}>{item.ativo ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/alunos/${item.id}`} className="inline-flex items-center gap-1 text-xs font-black text-brand">
                      <Eye size={14} /> Ficha
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
