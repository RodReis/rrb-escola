"use client";

import { useRef, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteContratoAction } from "@/lib/actions/folha-cadastros";

export function ExcluirContratoButton({ id, nome }: { id: string; nome: string }) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  async function handleExcluir() {
    const ok = await confirm({
      title: "Excluir contrato",
      message: `Excluir o contrato de ${nome}? Esta ação é irreversível. Contratos que já entraram em folha não podem ser excluídos.`,
      confirmLabel: "Excluir contrato",
      variant: "danger",
    });
    if (ok && formRef.current) {
      startTransition(() => {
        formRef.current?.requestSubmit();
      });
    }
  }

  return (
    <form ref={formRef} action={deleteContratoAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="button"
        onClick={handleExcluir}
        disabled={isPending}
        className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline disabled:opacity-50"
      >
        <Trash2 size={14} /> Excluir
      </button>
    </form>
  );
}
