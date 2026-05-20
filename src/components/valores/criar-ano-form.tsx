"use client";

import { Plus } from "lucide-react";
import { criarAnoLetivoAction } from "@/lib/actions/valores-praticados";

export function CriarAnoForm() {
  const proximoAno = new Date().getFullYear() + 1;
  return (
    <form action={criarAnoLetivoAction} className="flex items-center gap-2">
      <input
        name="ano_letivo"
        type="number"
        min={2000}
        max={2100}
        defaultValue={proximoAno}
        className="w-24 rounded-ui border border-line bg-surface px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-ui bg-brand px-3 py-1.5 text-sm font-semibold text-paper hover:bg-brand/90"
      >
        <Plus size={14} /> Novo ano
      </button>
    </form>
  );
}
