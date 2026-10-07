"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/card";
import { AssociacoesForm } from "@/components/questionario/associacoes-form";
import { AssociacoesLista } from "@/components/questionario/associacoes-lista";
import type { ProfessorOption } from "@/lib/data/pedagogico";
import type { AssociacaoRow, QuestionarioRow, TurmaOpcao } from "@/lib/questionario/tipos";

type Props = {
  associacoes: AssociacaoRow[];
  questionarios: QuestionarioRow[];
  turmas: TurmaOpcao[];
  professores: ProfessorOption[];
  podeCriar: boolean;
  podeEditar: boolean;
};

export function AssociacoesManager({ associacoes, questionarios, turmas, professores, podeCriar, podeEditar }: Props) {
  const [editando, setEditando] = useState<AssociacaoRow | null>(null);
  const [formKey, setFormKey] = useState(0);
  const mostrarForm = editando ? podeEditar : podeCriar;

  return (
    <div className="grid gap-6">
      {mostrarForm ? (
        <Panel>
          <AssociacoesForm
            key={`${editando?.id ?? "novo"}-${formKey}`}
            questionarios={questionarios}
            turmas={turmas}
            professores={professores}
            edicao={editando}
            onConcluir={() => {
              setEditando(null);
              setFormKey((k) => k + 1);
            }}
          />
        </Panel>
      ) : null}
      <AssociacoesLista associacoes={associacoes} podeEditar={podeEditar} onEditar={setEditando} />
    </div>
  );
}
