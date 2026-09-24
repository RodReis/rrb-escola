"use client";

import Link from "next/link";
import { Pencil, FileText } from "lucide-react";

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
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand hover:bg-brand/10"
      >
        <Pencil size={18} />
      </Link>

      <Link
        href={`/alunos/${alunoId}/boletim`}
        title="Boletim"
        aria-label="Boletim"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink/60 hover:bg-ink/10"
      >
        <FileText size={18} />
      </Link>
    </div>
  );
}
