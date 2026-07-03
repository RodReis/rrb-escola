import Link from "next/link";
import { Plus, Upload, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { ExportStudentsReportButton } from "@/components/pdf/export-students-report-button";
import { StudentFilters } from "@/components/students/student-filters";
import { AlunoRowActions } from "@/components/students/aluno-row-actions";
import { getStudentsReport, listStudents, getStudentSegmentCounts } from "@/lib/data/students";
import { getSignedFotoUrls } from "@/lib/storage/photos";
import { requirePermission } from "@/lib/auth/session";

type EnrollmentRef = {
  status?: string | null;
  series?: { nome?: string | null } | { nome?: string | null }[] | null;
  turmas?: { nome?: string | null } | { nome?: string | null }[] | null;
  planos?: { nome?: string | null } | { nome?: string | null }[] | null;
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
  await requirePermission("alunos", "read");
  const params = await searchParams;
  const pageParam = Number.parseInt(params.page ?? "1", 10);
  const filters = {
    nome:     params.nome     || undefined,
    serieId:  params.serie    || undefined,
    turmaId:  params.turma    || undefined,
    segmento: params.segmento || undefined,
    page:     Number.isNaN(pageParam) ? 1 : pageParam
  };

  const [{ rows: students, total, page, pageSize }, reportRows, counts] = await Promise.all([
    listStudents(filters),
    getStudentsReport(),
    getStudentSegmentCounts()
  ]);

  const signedFotos = await getSignedFotoUrls(
    students.map((s) => ("foto_url" in s ? (s.foto_url as string | null) : null))
  );

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = (page - 1) * pageSize + students.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(target: number) {
    const sp = new URLSearchParams();
    if (filters.nome) sp.set("nome", filters.nome);
    if (params.serie) sp.set("serie", params.serie);
    if (params.turma) sp.set("turma", params.turma);
    if (filters.segmento) sp.set("segmento", filters.segmento);
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `/alunos?${qs}` : "/alunos";
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Gestão", href: "/" },
          { label: "Alunos" }
        ]}
        title="Lista de Alunos"
        counter={total.toLocaleString("pt-BR")}
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
              {total === 0 ? (
                "Nenhum aluno encontrado"
              ) : (
                <>
                  Mostrando <strong className="text-ink">{firstRow.toLocaleString("pt-BR")}</strong>
                  –<strong className="text-ink">{lastRow.toLocaleString("pt-BR")}</strong> de{" "}
                  <strong className="text-ink">{total.toLocaleString("pt-BR")}</strong> alunos
                </>
              )}
            </span>
            {totalPages > 1 ? (
              <span className="ds-pager">
                {page > 1 ? (
                  <ButtonLink href={pageHref(page - 1)} variant="secondary" className="rb-btn sm">
                    Anterior
                  </ButtonLink>
                ) : (
                  <button className="pg-btn" disabled>Anterior</button>
                )}
                <span className="px-2 text-ink/60 rb-num">
                  Página {page} de {totalPages}
                </span>
                {page < totalPages ? (
                  <ButtonLink href={pageHref(page + 1)} variant="secondary" className="rb-btn sm">
                    Próxima
                  </ButtonLink>
                ) : (
                  <button className="pg-btn" disabled>Próxima</button>
                )}
              </span>
            ) : null}
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
                <td colSpan={7} className="px-5 py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink/60">
                    <Users size={28} />
                    <p className="text-sm font-medium">
                      {filters.nome || filters.segmento
                        ? "Nenhum aluno corresponde aos filtros."
                        : "Nenhum aluno cadastrado."}
                    </p>
                    {filters.nome || filters.segmento ? (
                      <ButtonLink href="/alunos" variant="secondary" className="rb-btn sm mt-1">
                        Limpar filtros
                      </ButtonLink>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : null}
            {students.map((student) => {
              const enrollment = activeEnrollment(student.matriculas);
              const series = one(enrollment?.series);
              const turma  = one(enrollment?.turmas);
              const plano  = one(enrollment?.planos);
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
                        <span className="text-xs text-ink/60 font-medium">
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
                        <span className="text-xs text-ink/60">{series?.nome ?? ""}</span>
                      </span>
                    ) : (
                      <span className="text-ink/38">—</span>
                    )}
                  </td>
                  <td>
                    {plano?.nome ? (
                      <span className="font-semibold text-ink">{plano.nome}</span>
                    ) : (
                      <span className="text-ink/38">—</span>
                    )}
                  </td>
                  <td>
                    {resp ? (
                      <span className="flex flex-col leading-tight">
                        <span className="font-semibold text-ink">{resp.nome}</span>
                        <span className="text-xs text-ink/60">{resp.celular || resp.telefone || "—"}</span>
                      </span>
                    ) : (
                      <span className="text-ink/38">—</span>
                    )}
                  </td>
                  <td>
                    <StatusPill tone={student.ativo ? "success" : "neutral"}>
                      {student.ativo ? "Ativo" : "Inativo"}
                    </StatusPill>
                  </td>
                  <td className="pr-4 text-right">
                    <AlunoRowActions
                      alunoId={student.id}
                      alunoNome={student.nome}
                      ativo={student.ativo ?? false}
                    />
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
