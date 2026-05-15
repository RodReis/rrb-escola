import { ExportStudentButton } from "@/components/pdf/export-student-button";
import { StudentSheetView } from "@/components/students/student-sheet";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStudentSheet } from "@/lib/data/students";

export default async function StudentPage({ params }: { params: { id: string } }) {
  const student = await getStudentSheet(params.id);
  const activeEnrollment = student.matriculas.find((item) => item.status === "ativa") ?? student.matriculas[0];

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Gestao / Ficha do aluno</p>
          <h1 className="mt-7 font-serif text-4xl text-ink">{student.nome}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Matricula {student.matricula_codigo}</span>
            {activeEnrollment ? <Badge tone="green">{activeEnrollment.status}</Badge> : null}
            {activeEnrollment?.series?.nome ? <span>{activeEnrollment.series.nome}</span> : null}
            {activeEnrollment?.turmas?.nome ? <span>{activeEnrollment.turmas.nome}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/alunos" variant="secondary">Voltar</ButtonLink>
          <ButtonLink href={`/alunos/${student.id}/editar`} variant="primary">Editar</ButtonLink>
          <ExportStudentButton student={student} />
        </div>
      </header>
      <StudentSheetView student={student} />
    </div>
  );
}
