"use client";

import { Trash2 } from "lucide-react";
import { deleteEmployeeAction } from "@/lib/actions/rh";

export function DeleteEmployeeButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteEmployeeAction}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(`Tem certeza que deseja EXCLUIR "${name}" permanentemente?\n\nIsto remove o funcionário e TODOS os registros vinculados (folhas de pagamento, etc).\n\nEsta operação não pode ser desfeita.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline"
        title="Excluir permanentemente"
      >
        <Trash2 size={14} /> Excluir
      </button>
    </form>
  );
}
