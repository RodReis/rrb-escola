import Link from "next/link";
import { Eye, Plus, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExportStudentsReportButton } from "@/components/pdf/export-students-report-button";
import { StudentFilters } from "@/components/students/student-filters";
import { getStudentsReport, listStudents, getStudentFilterOptions } from "@/lib/data/students";
import { toggleStudentAction } from "@/lib/actions/students";

type EnrollmentRef = {
  status?: string | null;
  series?: { nome?: string | null } | { nome?: string | null }[] | null;
  turmas?: { nome?: string | null } | { nome?: string | null }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function activeEnrollment(enrollments: EnrollmentRef[] | null | undefined) {
  return enrollments?.find((item) => item.status === "ativa") ?? enrollments?.[0] ?? null;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const filters = {
    nome:    params.nome    || undefined,
    serieId: params.serie   || undefined,
    turmaId: params.turma   || undefined,
  };

  const [students, reportRows, filterOptions] = await Promise.all([
    listStudents(filters),
    getStudentsReport(),
    getStudentFilterOptions(),
  ]);
  const activeStudents = students.filter((student) => student.ativo).length;
  const inactiveStudents = students.length - activeStudents;
  const activeEnrollments = students.filter((student) => student.matriculas?.some((item) => item.status === "ativa")).length;

  const summary = [
    ["Total", String(students.length)],
    ["Ativos", String(activeStudents)],
    ["Matriculas ativas", String(activeEnrollments)],
    ["Inativos", String(inactiveStudents)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Gestao</span>
              <span className="text-line">/</span>
              <span className="text-brand">Alunos</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Alunos <span className="font-serif italic text-ink/42">{students.length}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Cadastro completo dos alunos ativos, responsaveis e matriculas do ano letivo.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ExportStudentsReportButton rows={reportRows} />
              <ButtonLink href="/importacoes" variant="secondary">
                <Upload size={16} /> Importar
              </ButtonLink>
              <ButtonLink href="/alunos/novo" variant="accent" className="shadow-[0_12px_26px_rgba(255,36,36,0.28)]">
                <Plus size={16} /> Novo aluno
              </ButtonLink>
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
        <div className="flex flex-col gap-4 border-b border-line px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-ink">Lista de alunos</h2>
              <p className="text-sm text-ink/60">Consulta rapida e acesso direto a ficha cadastral.</p>
            </div>
            <span className="text-sm font-medium text-ink/50">{students.length} aluno{students.length !== 1 ? "s" : ""}</span>
          </div>
          <StudentFilters series={filterOptions.series} turmas={filterOptions.turmas} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-muted text-xs font-black uppercase tracking-[0.1em] text-ink/62">
              <tr>
                <th className="w-[110px] px-5 py-3">Matricula</th>
                <th className="px-5 py-3">Aluno</th>
                <th className="w-[180px] px-5 py-3">Serie / Turma</th>
                <th className="w-[160px] whitespace-nowrap px-5 py-3">Responsável</th>
                <th className="w-[90px] px-5 py-3">Status</th>
                <th className="w-[120px] px-5 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm font-medium text-ink/60">
                    Nenhum aluno cadastrado.
                  </td>
                </tr>
              ) : null}
              {students.map((student) => {
                const enrollment = activeEnrollment(student.matriculas);
                const series = one(enrollment?.series);
                const turma = one(enrollment?.turmas);

                return (
                  <tr key={student.id} className="border-t border-line transition hover:bg-muted/60">
                    <td className="whitespace-nowrap px-5 py-4 font-black text-brand">{student.matricula_codigo}</td>
                    <td className="px-5 py-4">
                      <Link href={`/alunos/${student.id}`} className="font-black uppercase text-ink hover:text-brand">
                        {student.nome}
                      </Link>
                      {student.cpf && (
                        <span className="block text-xs font-medium text-ink/45">{student.cpf}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {series?.nome || turma?.nome ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium uppercase text-ink/80">{series?.nome ?? "Sem serie"}</span>
                          <span className="text-xs uppercase text-ink/45">{turma?.nome ?? "Sem turma"}</span>
                        </span>
                      ) : (
                        <span className="text-ink/38">Sem matricula ativa</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {(() => {
                        const resp = Array.isArray(student.responsaveis_aluno)
                          ? student.responsaveis_aluno[0]
                          : null;
                        if (!resp) return <span className="text-ink/38">-</span>;
                        return (
                          <span className="flex flex-col gap-0.5">
                            <span className="font-medium uppercase text-ink/80">{resp.nome}</span>
                            <span className="whitespace-nowrap text-xs text-ink/50">{resp.celular || resp.telefone || "-"}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={student.ativo ? "green" : "red"}>{student.ativo ? "Ativo" : "Inativo"}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-3">
                        <form action={toggleStudentAction}>
                          <input type="hidden" name="aluno_id" value={student.id} />
                          <input type="hidden" name="ativo" value={student.ativo ? "" : "on"} />
                          <button className="text-xs font-black text-clay">{student.ativo ? "Desativar" : "Ativar"}</button>
                        </form>
                        <Link className="inline-flex items-center gap-1 text-xs font-black text-brand" href={`/alunos/${student.id}`}>
                          <Eye size={14} /> Ficha
                        </Link>
                      </div>
                    </td>
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
