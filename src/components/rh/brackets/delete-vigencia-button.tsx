"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { deleteVigenciaAction } from "@/lib/actions/brackets";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function DeleteVigenciaButton({ table, vigencia }: { table: "inss" | "ir"; vigencia: string }) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={deleteVigenciaAction} className="inline">
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="vigencia" value={vigencia} />
      <button
        type="button"
        className="ds-button ds-button-secondary text-danger"
        onClick={async () => {
          const ok = await confirm({
            title: "Excluir vigência",
            message: `Excluir vigência ${table.toUpperCase()} ${vigencia}? Todas as faixas desta vigência serão removidas.`,
            confirmLabel: "Excluir",
            variant: "danger",
          });
          if (ok) formRef.current?.requestSubmit();
        }}
      >
        <Trash2 size={14} /> Excluir vigência
      </button>
    </form>
  );
}
