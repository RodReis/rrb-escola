"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, FileText, UserPlus, XCircle } from "lucide-react";
import { CancelarMatriculaDialog } from "@/components/matriculas/cancelar-matricula-dialog";
import { derivarIconeAcao } from "@/lib/students/icone-acao";

type Props = {
  alunoId: string;
  alunoNome: string;
  ativo: boolean;
  matriculaAtivaNoAno: boolean;
  matriculaId: string;
  serieNome: string;
  turmaNome: string;
  anoLetivo: number;
};

// "Ver ficha" nao vira icone: clicar no nome do aluno (celula anterior) ja
// leva pra la — repetir a acao aqui seria redundante.
export function AlunoRowActions({
  alunoId,
  alunoNome,
  ativo,
  matriculaAtivaNoAno,
  matriculaId,
  serieNome,
  turmaNome,
  anoLetivo,
}: Props) {
  const router = useRouter();
  const [dialogAberto, setDialogAberto] = useState(false);
  const icone = derivarIconeAcao(ativo, matriculaAtivaNoAno);

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

      {icone === "cancelar" ? (
        <button
          type="button"
          onClick={() => setDialogAberto(true)}
          title="Cancelar matrícula"
          aria-label="Cancelar matrícula"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-danger hover:bg-danger/10"
        >
          <XCircle size={18} />
        </button>
      ) : (
        <Link
          href={`/matriculas?aluno_id=${alunoId}#nova-matricula`}
          title="Matricular"
          aria-label="Matricular"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-success hover:bg-success/10"
        >
          <UserPlus size={18} />
        </Link>
      )}

      <Link
        href={`/alunos/${alunoId}/boletim`}
        title="Boletim"
        aria-label="Boletim"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink/60 hover:bg-ink/10"
      >
        <FileText size={18} />
      </Link>

      {icone === "cancelar" ? (
        <CancelarMatriculaDialog
          matriculaId={matriculaId}
          alunoId={alunoId}
          alunoNome={alunoNome}
          serieNome={serieNome}
          turmaNome={turmaNome}
          anoLetivo={anoLetivo}
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          onSuccess={() => {
            setDialogAberto(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
