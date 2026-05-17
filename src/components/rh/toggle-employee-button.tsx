"use client";

import { Power, PowerOff } from "lucide-react";
import { toggleEmployeeAction } from "@/lib/actions/rh";

export function ToggleEmployeeButton({ id, name, ativo }: { id: string; name: string; ativo: boolean }) {
  const label = ativo ? "Desativar" : "Ativar";
  const Icon = ativo ? PowerOff : Power;
  return (
    <form
      action={toggleEmployeeAction}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(`Tem certeza que deseja ${label.toUpperCase()} "${name}"?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={ativo ? "" : "on"} />
      <button
        type="submit"
        className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline ${ativo ? "text-warning" : "text-success"}`}
        title={label}
      >
        <Icon size={14} /> {label}
      </button>
    </form>
  );
}
