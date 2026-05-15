import { StudentEditForm } from "@/components/students/student-edit-form";
import { StudentDocumentsPanel } from "@/components/students/student-documents-panel";
import { StudentGatePanel } from "@/components/students/student-gate-panel";
import { StudentPhotoUpload } from "@/components/students/student-photo-upload";
import { StudentRelatedPanel } from "@/components/students/student-related-panel";
import { ButtonLink } from "@/components/ui/button";
import { getStudentDocuments } from "@/lib/data/documents";
import { getStudentGateSettings } from "@/lib/data/gate";
import { getStudentSheet } from "@/lib/data/students";

export default async function EditStudentPage({ params }: { params: { id: string } }) {
  const [student, documents, gateSettings] = await Promise.all([
    getStudentSheet(params.id),
    getStudentDocuments(params.id),
    getStudentGateSettings(params.id)
  ]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Gestao / Editar ficha</p>
          <h1 className="mt-7 font-serif text-4xl text-ink">{student.nome}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Atualize dados cadastrais, documentos, portaria, matriculas e informacoes relacionadas do aluno.
          </p>
        </div>
        <ButtonLink href={`/alunos/${student.id}`} variant="secondary">
          Voltar para ficha
        </ButtonLink>
      </header>
      <StudentPhotoUpload alunoId={student.id} fotoUrl={student.foto_url} nome={student.nome} />
      <StudentDocumentsPanel alunoId={student.id} documents={documents} />
      <StudentGatePanel alunoId={student.id} settings={gateSettings} />
      <StudentEditForm student={student} />
      <StudentRelatedPanel student={student} />
    </div>
  );
}
