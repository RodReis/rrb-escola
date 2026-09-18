"use client";

import { exportStudentPdf } from "@/components/pdf/export-student-button";
import { QuickDocumentActions } from "@/components/students/quick-document-actions";
import type { StudentSheet } from "@/lib/types";

type MatriculaAtiva = { id: string; codigo: string | null };
type TemplateLite = { id: string; nome: string };

export function StudentHeaderActions({
  student,
  matriculaAtiva,
  templates,
}: {
  student: StudentSheet;
  matriculaAtiva: MatriculaAtiva | null;
  templates: TemplateLite[];
}) {
  return (
    <QuickDocumentActions
      matriculaAtiva={matriculaAtiva}
      templates={templates}
      onExportFichaPdf={() => exportStudentPdf(student)}
    />
  );
}
