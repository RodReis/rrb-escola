"use client";

import { Search } from "lucide-react";
import type { PipelineColuna } from "./types";
import { FilterDropdown } from "./filter-dropdown";

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

  const colunaOptions = [
    { value: "", label: "Todas as colunas" },
    ...colunas.map((c) => ({ value: c.id, label: c.nome })),
  ];
  const usuarioOptions = [
    { value: "", label: "Todos os responsáveis" },
    ...usuarios.map((u) => ({ value: u.id, label: u.nome })),
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {/* Busca */}
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-ink)/0.35)]" />
        <input
          type="text"
          value={filtros.nome}
          onChange={(e) => set("nome", e.target.value)}
          placeholder="Buscar por nome…"
          className="h-8 w-44 rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] pl-7 pr-3 text-sm text-[rgb(var(--color-ink))] placeholder:text-[rgb(var(--color-ink)/0.35)] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-brand)/0.4)]"
        />
      </div>

      {/* Coluna */}
      <FilterDropdown
        value={filtros.colunaId}
        options={colunaOptions}
        onChange={(v) => set("colunaId", v)}
        placeholder="Todas as colunas"
        ariaLabel="Filtrar por coluna"
        width={170}
      />

      {/* Responsável */}
      {usuarios.length > 0 && (
        <FilterDropdown
          value={filtros.assignedTo}
          options={usuarioOptions}
          onChange={(v) => set("assignedTo", v)}
          placeholder="Todos os responsáveis"
          ariaLabel="Filtrar por responsável"
          width={195}
        />
      )}

      {/* Sem resposta */}
      <button
        type="button"
        onClick={() => set("semResposta", !filtros.semResposta)}
        className={`h-8 rounded-md border px-3 text-xs transition-colors whitespace-nowrap ${
          filtros.semResposta
            ? "border-[rgb(var(--color-danger))] bg-[rgb(var(--color-danger)/0.08)] text-[rgb(var(--color-danger))]"
            : "border-[rgb(var(--color-line))] text-[rgb(var(--color-ink)/0.5)] hover:bg-[rgb(var(--color-muted))]"
        }`}
      >
        Sem resposta
      </button>

      {/* Limpar */}
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
