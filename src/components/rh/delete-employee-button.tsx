"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { deleteEmployeeAction } from "@/lib/actions/rh";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function DeleteEmployeeButton({ id, name }: { id: string; name: string }) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={deleteEmployeeAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline"
        title="Excluir permanentemente"
        onClick={async () => {
          const ok = await confirm({
            title: "Excluir funcionário",
            message: `Tem certeza que quer excluir "${name}" permanentemente? Isso remove o funcionário e todos os registros vinculados (folhas de pagamento, etc.) e não pode ser desfeito.`,
            confirmLabel: "Excluir",
            variant: "danger",
          });
          if (ok) formRef.current?.requestSubmit();
        }}
      >
        <Trash2 size={14} /> Excluir
      </button>
    </form>
  );
}
