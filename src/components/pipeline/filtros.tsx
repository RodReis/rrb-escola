"use client";

import { Search } from "lucide-react";
import type { PipelineColuna } from "./types";

export type FiltrosPipeline = {
  nome: string;
  colunaId: string;
  assignedTo: string;
  semResposta: boolean;
};

type Usuario = { id: string; nome: string };

type Props = {
  filtros: FiltrosPipeline;
  onChange: (f: FiltrosPipeline) => void;
  colunas: PipelineColuna[];
  usuarios: Usuario[];
};

export function PipelineFiltros({ filtros, onChange, colunas, usuarios }: Props) {
  function set(field: keyof FiltrosPipeline, value: string | boolean) {
    onChange({ ...filtros, [field]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      {/* Busca por nome */}
      <div className="relative">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-ink)/0.35)]"
        />
        <input
          type="text"
          value={filtros.nome}
          onChange={(e) => set("nome", e.target.value)}
          placeholder="Buscar por nome…"
          className="h-8 rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] pl-7 pr-3 text-sm text-[rgb(var(--color-ink))] placeholder:text-[rgb(var(--color-ink)/0.35)] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-brand)/0.4)] w-48"
        />
      </div>

      {/* Filtro por coluna */}
      <select
        value={filtros.colunaId}
        onChange={(e) => set("colunaId", e.target.value)}
        className="h-8 w-40 rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 text-sm text-[rgb(var(--color-ink))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-brand)/0.4)]"
        aria-label="Filtrar por coluna"
      >
        <option value="">Todas as colunas</option>
        {colunas.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>

      {/* Filtro por responsável */}
      {usuarios.length > 0 && (
        <select
          value={filtros.assignedTo}
          onChange={(e) => set("assignedTo", e.target.value)}
          className="h-8 w-44 rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 text-sm text-[rgb(var(--color-ink))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-brand)/0.4)]"
          aria-label="Filtrar por responsável"
        >
          <option value="">Todos os responsáveis</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
      )}

      {/* Toggle sem resposta */}
      <button
        type="button"
        onClick={() => set("semResposta", !filtros.semResposta)}
        className={`h-8 rounded-md border px-3 text-xs transition-colors ${
          filtros.semResposta
            ? "border-[rgb(var(--color-danger))] bg-[rgb(var(--color-danger)/0.08)] text-[rgb(var(--color-danger))]"
            : "border-[rgb(var(--color-line))] text-[rgb(var(--color-ink)/0.5)] hover:bg-[rgb(var(--color-muted))]"
        }`}
      >
        ● Sem resposta
      </button>

      {/* Limpar filtros */}
      {(filtros.nome || filtros.colunaId || filtros.assignedTo || filtros.semResposta) && (
        <button
          type="button"
          onClick={() => onChange({ nome: "", colunaId: "", assignedTo: "", semResposta: false })}
          className="h-8 rounded-md px-3 text-xs text-[rgb(var(--color-ink)/0.5)] hover:bg-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-ink))]"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
