"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { normalizarTexto } from "@/lib/relatorio-dinamico/formatar";
import type { RegistroResumo } from "@/lib/relatorio-dinamico/tipos";

type Props = { registros: RegistroResumo[]; selecionados: Set<string>; onChange: (s: Set<string>) => void; carregando: boolean };

export function RegistrosLista({ registros, selecionados, onChange, carregando }: Props) {
  const [busca, setBusca] = useState("");
  const b = normalizarTexto(busca);
  const visiveis = b ? registros.filter((r) => normalizarTexto(r.nome).includes(b)) : registros;
  const todos = visiveis.length > 0 && visiveis.every((r) => selecionados.has(r.id));
  const alternarTodos = () => {
    const s = new Set(selecionados);
    visiveis.forEach((r) => (todos ? s.delete(r.id) : s.add(r.id)));
    onChange(s);
  };
  const alternar = (id: string) => {
    const s = new Set(selecionados);
    if (s.has(id)) s.delete(id); else s.add(id);
    onChange(s);
  };

  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-muted px-3 py-2.5">
        <label className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wide text-ink/60">
          <input type="checkbox" className="h-4 w-4 shrink-0 accent-brand" checked={todos} onChange={alternarTodos} aria-label="Marcar todos os registros" />
          Nome
        </label>
        {carregando ? <Spinner className="ml-1" /> : null}
        <input aria-label="Pesquisar registros" placeholder="Pesquisar" value={busca} onChange={(e) => setBusca(e.target.value)} className="ml-auto max-w-xs" />
        <span className="shrink-0 text-xs font-medium text-ink/55">
          {selecionados.size === 0 ? "Nenhum selecionado" : `${selecionados.size} ${selecionados.size === 1 ? "selecionado" : "selecionados"}`}
        </span>
      </div>
      <ul className="max-h-80 overflow-y-auto">
        {!carregando && visiveis.length === 0 ? <li className="p-6 text-center text-sm text-ink/55">Nenhum registro encontrado com esses filtros.</li> : null}
        {visiveis.map((r) => (
          <li key={r.id} className="grid grid-cols-[16px_1fr_auto] items-center gap-3 border-b border-line/60 px-3 py-2 text-sm text-ink last:border-b-0 hover:bg-muted/60">
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-brand" aria-label={r.nome} checked={selecionados.has(r.id)} onChange={() => alternar(r.id)} />
            <span className="truncate" title={r.nome}>{r.nome}</span>
            {r.detalhe ? <span className="shrink-0 text-xs text-ink/50">{r.detalhe}</span> : <span />}
          </li>
        ))}
      </ul>
    </div>
  );
}
