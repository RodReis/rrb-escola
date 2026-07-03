"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Eye, Pencil, UserCheck, UserX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toggleStudentAction, deleteStudentAction } from "@/lib/actions/students";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Props = {
  alunoId: string;
  alunoNome: string;
  ativo: boolean;
};

export function AlunoRowActions({ alunoId, alunoNome, ativo }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  async function handleToggle() {
    setOpen(false);
    const label = ativo ? "desativar" : "ativar";
    const ok = await confirm({
      title: ativo ? "Desativar aluno" : "Ativar aluno",
      message: `Tem certeza que quer ${label} o aluno "${alunoNome}"?`,
      confirmLabel: ativo ? "Desativar" : "Ativar",
      variant: ativo ? "warning" : "default",
    });
    if (!ok) return;
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("aluno_id", alunoId);
      fd.append("ativo", ativo ? "" : "on");
      await toggleStudentAction(fd);
      toast.success(`Aluno ${label === "ativar" ? "ativado" : "desativado"}.`);
    } catch {
      toast.error("Falha ao alterar status.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setOpen(false);
    const ok = await confirm({
      title: "Excluir aluno",
      message: `Tem certeza que quer excluir "${alunoNome}"? Esta operação remove todos os dados vinculados e não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (!ok) return;
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("aluno_id", alunoId);
      await deleteStudentAction(fd);
      toast.success("Aluno excluído.");
    } catch {
      toast.error("Falha ao excluir aluno.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Mais ações"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink/60 transition hover:bg-muted hover:text-ink disabled:opacity-40"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-line bg-surface py-1 shadow-soft"
        >
          <a
            href={`/alunos/${alunoId}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-muted"
          >
            <Eye size={14} className="text-ink/50" />
            Ver ficha
          </a>

          <a
            href={`/alunos/${alunoId}/editar`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-muted"
          >
            <Pencil size={14} className="text-ink/50" />
            Editar
          </a>

          <div className="my-1 border-t border-line" />

          <button
            type="button"
            role="menuitem"
            onClick={handleToggle}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-muted"
          >
            {ativo ? (
              <>
                <UserX size={14} className="text-warning/70" />
                Desativar aluno
              </>
            ) : (
              <>
                <UserCheck size={14} className="text-success/70" />
                Ativar aluno
              </>
            )}
          </button>

          <div className="my-1 border-t border-line" />

          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/5"
          >
            <Trash2 size={14} />
            Excluir aluno
          </button>
        </div>
      )}
    </div>
  );
}
