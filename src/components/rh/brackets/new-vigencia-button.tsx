"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createBracketVigenciaAction } from "@/lib/actions/brackets";

export function NewVigenciaButton({
  table,
  vigencias
}: {
  table: "inss" | "ir";
  vigencias: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ds-button ds-button-primary"
      >
        <Plus size={14} /> Nova vigência
      </button>
    );
  }

  return (
    <form action={createBracketVigenciaAction} className="flex items-center gap-2 rounded-ui border border-line bg-surface p-3">
      <input type="hidden" name="table" value={table} />
      <label className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-ink/70">Início</span>
        <input name="vigencia_inicio" type="date" required className="text-sm" />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-ink/70">Copiar de</span>
        <select name="copy_from" defaultValue={vigencias[0] ?? ""}>
          <option value="">(vazia)</option>
          {vigencias.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="ds-button ds-button-primary">Criar</button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-ink/55 hover:text-brand">
        Cancelar
      </button>
    </form>
  );
}
