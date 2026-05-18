"use client";

import { exportStudentPdf } from "@/components/pdf/export-student-button";
import { QuickDocumentActions } from "@/components/students/quick-document-actions";
import type { StudentSheet } from "@/lib/types";

type MatriculaAtiva = { id: string; codigo: string | null };

export function StudentHeaderActions({
  student,
  matriculaAtiva,
}: {
  student: StudentSheet;
  matriculaAtiva: MatriculaAtiva | null;
}) {
  return (
    <QuickDocumentActions
      alunoId={student.id}
      matriculaAtiva={matriculaAtiva}
      onExportFichaPdf={() => exportStudentPdf(student)}
    />
  );
}
