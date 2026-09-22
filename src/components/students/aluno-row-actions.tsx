"use client";

import Link from "next/link";
import { Pencil, UserCheck, UserX, Trash2 } from "lucide-react";
import { toggleStudentAction, deleteStudentAction } from "@/lib/actions/students";
import { RowActionButton } from "@/components/ui/row-action-button";

type Props = {
  alunoId: string;
  alunoNome: string;
  ativo: boolean;
};

// "Ver ficha" nao vira icone: clicar no nome do aluno (celula anterior) ja
// leva pra la — repetir a acao aqui seria redundante.
export function AlunoRowActions({ alunoId, alunoNome, ativo }: Props) {
  return (
    <div className="inline-flex items-center justify-center gap-1">
      <Link
        href={`/alunos/${alunoId}/editar`}
        title="Editar"
        aria-label="Editar"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-brand/10"
      >
        <Pencil size={15} />
      </Link>

      {ativo ? (
        <RowActionButton
          action={toggleStudentAction}
          args={{ aluno_id: alunoId, ativo: "" }}
          icon={UserX}
          label="Desativar"
          tone="warning"
          confirm={{
            title: "Desativar aluno",
            message: `Tem certeza que quer desativar o aluno "${alunoNome}"?`,
            confirmLabel: "Desativar",
            variant: "warning",
          }}
          success="Aluno desativado."
          error="Falha ao alterar status."
        />
      ) : (
        <RowActionButton
          action={toggleStudentAction}
          args={{ aluno_id: alunoId, ativo: "on" }}
          icon={UserCheck}
          label="Ativar"
          tone="success"
          confirm={{
            title: "Ativar aluno",
            message: `Tem certeza que quer ativar o aluno "${alunoNome}"?`,
            confirmLabel: "Ativar",
          }}
          success="Aluno ativado."
          error="Falha ao alterar status."
        />
      )}

      <RowActionButton
        action={deleteStudentAction}
        args={{ aluno_id: alunoId }}
        icon={Trash2}
        label="Excluir"
        tone="danger"
        confirm={{
          title: "Excluir aluno",
          message: `Tem certeza que quer excluir "${alunoNome}"? Esta operação remove todos os dados vinculados e não pode ser desfeita.`,
          confirmLabel: "Excluir",
          variant: "danger",
        }}
        // deleteStudentAction faz redirect() no sucesso: useAction (dentro de
        // RowActionButton) deixa a excecao NEXT_REDIRECT subir e o Next
        // navega para /alunos.
        error="Falha ao excluir aluno."
      />
    </div>
  );
}
