"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteDeclaracaoModeloAction } from "@/lib/actions/declaracoes";

type Props = { id: string; nome: string };

export function DeclaracaoModeloRowActions({ id, nome }: Props) {
  const confirm = useConfirm();

  async function excluir() {
    const ok = await confirm({
      title: "Excluir modelo de declaração",
      message: `Tem certeza que deseja excluir "${nome}"? Esta ação não pode ser desfeita.`,
      variant: "danger",
      confirmLabel: "Excluir"
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", id);
    await deleteDeclaracaoModeloAction(fd);
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/declaracoes/modelos/${id}/editar`}
        aria-label="Editar"
        className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
      >
        <Pencil size={16} />
      </Link>
      <button
        type="button"
        onClick={excluir}
        aria-label="Excluir"
        className="rounded-ui p-1.5 text-danger hover:bg-danger/10"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
