import { ArrowLeft, CheckCircle2, Camera } from "lucide-react";
import { BiometricEnrollment } from "@/components/students/biometric-enrollment";
import { StudentEditForm } from "@/components/students/student-edit-form";
import { StudentEditTabs } from "@/components/students/student-edit-tabs";
import { StudentDocumentsPanel } from "@/components/students/student-documents-panel";
import { StudentGatePanel } from "@/components/students/student-gate-panel";
import { StudentPhotoUpload } from "@/components/students/student-photo-upload";
import { StudentRelatedPanel } from "@/components/students/student-related-panel";
import { ButtonLink } from "@/components/ui/button";
import { getStudentBiometryData } from "@/lib/data/biometrics";
import { getStudentDocuments } from "@/lib/data/documents";
import { getStudentGateSettings } from "@/lib/data/gate";
import { getStudentSheet } from "@/lib/data/students";
import { getSignedFotoUrl } from "@/lib/storage/photos";
import { requirePermission } from "@/lib/auth/session";

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePermission("alunos", "update");
  const { id } = await params;
  const { tab = "dados" } = await searchParams;

  const [student, documents, gateSettings, biometry] = await Promise.all([
    getStudentSheet(id),
    getStudentDocuments(id),
    getStudentGateSettings(id),
    getStudentBiometryData(id),
  ]);
  const fotoSrc = await getSignedFotoUrl(student.foto_url);

  return (
    <div className="grid gap-0">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-surface px-6 py-7">
        <div>
          <p className="ds-kicker">Gestao / Editar ficha</p>
          <h1 className="mt-7 font-display text-4xl text-ink">{student.nome}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Atualize dados cadastrais, documentos, portaria, matriculas e informacoes relacionadas do aluno.
          </p>
        </div>
        <ButtonLink href={`/alunos/${id}`} variant="secondary">
          <ArrowLeft size={14} /> Voltar para ficha
        </ButtonLink>
      </header>

      <div className="sticky top-0 z-10 bg-surface shadow-soft">
        <StudentEditTabs />
      </div>

      {(await searchParams).saved === "1" && (
        <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={16} /> Dados salvos com sucesso.
        </div>
      )}

      <div className="grid gap-6 py-6">
        {tab === "dados" && (
          <>
            <StudentPhotoUpload alunoId={student.id} fotoUrl={fotoSrc} nome={student.nome} />
            <StudentEditForm student={student} />
          </>
        )}

        {tab === "documentos" && (
          <StudentDocumentsPanel alunoId={student.id} documents={documents} />
        )}

        {tab === "portaria" && (
          <>
            <StudentGatePanel alunoId={student.id} settings={gateSettings} />
            <section className="rounded-panel border border-line bg-surface p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-2xl text-ink">
                <Camera size={20} className="text-brand" />
                Biometria facial (LGPD)
              </h2>
              <BiometricEnrollment
                alunoId={student.id}
                responsaveis={biometry.responsaveis}
                consentimento={biometry.consentimento}
                biometriaAtiva={biometry.biometriaAtiva}
                fotoReferenciaSignedUrl={biometry.fotoReferenciaSignedUrl}
              />
            </section>
          </>
        )}

        {tab === "relacionados" && (
          <StudentRelatedPanel student={student} />
        )}
      </div>
    </div>
  );
}
