"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { exportStudentPdf } from "@/components/pdf/export-student-button";
import { QuickDocumentActions } from "@/components/students/quick-document-actions";
import { CancelarMatriculaDialog } from "@/components/matriculas/cancelar-matricula-dialog";
import type { StudentSheet } from "@/lib/types";

type MatriculaAtiva = { id: string; codigo: string | null; serieNome: string; turmaNome: string; anoLetivo: number };
type TemplateLite = { id: string; nome: string; categoria?: string | null };

export function StudentHeaderActions({
  student,
  matriculaAtiva,
  templates,
}: {
  student: StudentSheet;
  matriculaAtiva: MatriculaAtiva | null;
  templates: TemplateLite[];
}) {
  const [dialogAberto, setDialogAberto] = useState(false);

  return (
    <>
      <QuickDocumentActions
        matriculaAtiva={matriculaAtiva}
        templates={templates}
        onExportFichaPdf={() => exportStudentPdf(student)}
      />
      {matriculaAtiva ? (
        <button
          type="button"
          onClick={() => setDialogAberto(true)}
          className="ds-button ds-button-secondary text-xs text-danger"
        >
          <XCircle size={14} /> Cancelar Matrícula
        </button>
      ) : null}
      {matriculaAtiva ? (
        <CancelarMatriculaDialog
          matriculaId={matriculaAtiva.id}
          alunoId={student.id}
          alunoNome={student.nome}
          serieNome={matriculaAtiva.serieNome}
          turmaNome={matriculaAtiva.turmaNome}
          anoLetivo={matriculaAtiva.anoLetivo}
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          onSuccess={() => window.location.reload()}
        />
      ) : null}
    </>
  );
}
