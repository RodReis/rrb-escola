"use client";

import { Trash2 } from "lucide-react";
import { deleteVigenciaAction } from "@/lib/actions/brackets";

export function DeleteVigenciaButton({ table, vigencia }: { table: "inss" | "ir"; vigencia: string }) {
  return (
    <form
      action={deleteVigenciaAction}
      onSubmit={(e) => {
        if (!confirm(`Excluir vigência ${table.toUpperCase()} ${vigencia}?`)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="vigencia" value={vigencia} />
      <button type="submit" className="ds-button ds-button-secondary text-danger">
        <Trash2 size={14} /> Excluir vigência
      </button>
    </form>
  );
}
