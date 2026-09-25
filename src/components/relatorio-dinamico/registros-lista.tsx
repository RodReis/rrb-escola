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
    <div className="grid gap-2">
      <label className="flex items-center gap-3 rounded-ui bg-brand px-4 py-3 text-sm font-semibold text-white">
        <input type="checkbox" checked={todos} onChange={alternarTodos} aria-label="Marcar todos os registros" />
        Nome {carregando ? <Spinner className="ml-2" /> : null}
      </label>
      <input aria-label="Pesquisar registros" placeholder="Pesquisar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <ul className="max-h-80 overflow-y-auto rounded-ui border border-line">
        {!carregando && visiveis.length === 0 ? <li className="p-6 text-center text-sm text-ink/55">Nenhum registro encontrado com esses filtros.</li> : null}
        {visiveis.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm text-ink odd:bg-muted">
            <input type="checkbox" aria-label={r.nome} checked={selecionados.has(r.id)} onChange={() => alternar(r.id)} />
            <span className="truncate">{r.nome}</span>
            {r.detalhe ? <span className="ml-auto shrink-0 text-xs text-ink/50">{r.detalhe}</span> : null}
          </li>
        ))}
      </ul>
      <p className="text-right text-xs font-medium text-ink/55">
        {selecionados.size === 0 ? "Nenhum item selecionado" : `${selecionados.size} ${selecionados.size === 1 ? "item selecionado" : "itens selecionados"}`}
      </p>
    </div>
  );
}
