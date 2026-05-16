import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { ExportStudentsReportButton } from "@/components/pdf/export-students-report-button";
import { StudentFilters } from "@/components/students/student-filters";
import { getStudentsReport, listStudents, getStudentSegmentCounts } from "@/lib/data/students";
import { toggleStudentAction } from "@/lib/actions/students";
import { getSignedFotoUrls } from "@/lib/storage/photos";

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
  searchParams
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const filters = {
    nome:     params.nome     || undefined,
    serieId:  params.serie    || undefined,
    turmaId:  params.turma    || undefined,
    segmento: params.segmento || undefined
  };

  const [students, reportRows, counts] = await Promise.all([
    listStudents(filters),
    getStudentsReport(),
    getStudentSegmentCounts()
  ]);

  const signedFotos = await getSignedFotoUrls(
    students.map((s) => ("foto_url" in s ? (s.foto_url as string | null) : null))
  );

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Gestão", href: "/" },
          { label: "Alunos" }
        ]}
        title="Lista de Alunos"
        counter={students.length.toLocaleString("pt-BR")}
        description="Cadastro completo dos alunos ativos e suas matrículas no ano letivo."
        actions={
          <>
            <ExportStudentsReportButton rows={reportRows} />
            <ButtonLink href="/importacoes" variant="secondary">
              <Upload size={14} /> Importar
            </ButtonLink>
            <ButtonLink href="/alunos/novo" variant="primary">
              <Plus size={14} /> Novo aluno
            </ButtonLink>
          </>
        }
      />

      <DataTableShell
        toolbar={
          <StudentFilters counts={counts} />
        }
        footer={
          <>
            <span>
              Mostrando <strong className="text-ink">{students.length}</strong> de{" "}
              <strong className="text-ink">{students.length}</strong> alunos
            </span>
            <span className="text-ink/45">Página 1</span>
          </>
        }
      >
        <table className="ds-dt min-w-[860px]">
          <thead>
            <tr>
              <th className="w-[42px]"></th>
              <th>Aluno</th>
              <th className="w-[170px]">Turma</th>
              <th className="w-[170px]">Plano</th>
              <th className="w-[200px]">Responsável</th>
              <th className="w-[160px]">Status</th>
              <th className="w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm font-medium text-ink/55">
                  Nenhum aluno cadastrado.
                </td>
              </tr>
            ) : null}
            {students.map((student) => {
              const enrollment = activeEnrollment(student.matriculas);
              const series = one(enrollment?.series);
              const turma  = one(enrollment?.turmas);
              const fotoUrl =
                signedFotos.get(("foto_url" in student ? (student.foto_url as string | null) : null) ?? "") ?? null;

              const resp = Array.isArray(student.responsaveis_aluno) ? student.responsaveis_aluno[0] : null;

              return (
                <tr key={student.id}>
                  <td className="pl-4">
                    <input type="checkbox" className="h-4 w-4 cursor-pointer accent-brand" />
                  </td>
                  <td>
                    <Link href={`/alunos/${student.id}`} className="flex items-center gap-3 group">
                      <Avatar name={student.nome} src={fotoUrl} size={36} />
                      <span className="flex flex-col leading-tight">
                        <span className="font-semibold text-ink group-hover:text-brand">{student.nome}</span>
                        <span className="text-xs text-ink/45 font-medium">
                          #{student.matricula_codigo}
                          {student.cpf ? <> · <span>{student.cpf}</span></> : null}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td>
                    {series?.nome || turma?.nome ? (
                      <span className="flex flex-col leading-tight">
                        <span className="font-semibold text-ink">{turma?.nome ?? series?.nome ?? "—"}</span>
                        <span className="text-xs text-ink/50">{series?.nome ?? ""}</span>
                      </span>
                    ) : (
                      <span className="text-ink/38">—</span>
                    )}
                  </td>
                  <td>
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold text-ink">—</span>
                      <span className="text-xs text-ink/45">—</span>
                    </span>
                  </td>
                  <td>
                    {resp ? (
                      <span className="flex flex-col leading-tight">
                        <span className="font-semibold text-ink">{resp.nome}</span>
                        <span className="text-xs text-ink/50">{resp.celular || resp.telefone || "—"}</span>
                      </span>
                    ) : (
                      <span className="text-ink/38">—</span>
                    )}
                  </td>
                  <td>
                    <StatusPill tone={student.ativo ? "success" : "danger"}>
                      {student.ativo ? "Em dia" : "Inativo"}
                    </StatusPill>
                  </td>
                  <td className="pr-4 text-right">
                    <form action={toggleStudentAction} className="inline">
                      <input type="hidden" name="aluno_id" value={student.id} />
                      <input type="hidden" name="ativo" value={student.ativo ? "" : "on"} />
                      <button
                        type="submit"
                        className="text-ink/40 hover:text-ink transition"
                        aria-label="Mais ações"
                        title={student.ativo ? "Desativar" : "Ativar"}
                      >
                        ⋯
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
