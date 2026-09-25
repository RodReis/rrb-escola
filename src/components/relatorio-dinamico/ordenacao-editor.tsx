"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColunaMeta, Ordenacao } from "@/lib/relatorio-dinamico/tipos";

type Props = { colunas: ColunaMeta[]; valor: Ordenacao[]; onChange: (o: Ordenacao[]) => void };

export function OrdenacaoEditor({ colunas, valor, onChange }: Props) {
  const livres = colunas.filter((c) => !valor.some((o) => o.key === c.key));
  const [escolhida, setEscolhida] = useState("");
  const label = (key: string) => colunas.find((c) => c.key === key)?.label ?? key;
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= valor.length) return;
    const nova = [...valor];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    onChange(nova);
  };

  return (
    <div className="grid gap-3">
      {colunas.length === 0 ? <p className="text-sm text-ink/55">Selecione colunas em "Colunas" para ordenar por elas. Sem ordenação, sai por nome.</p> : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-56 flex-1">
          Coluna para ordenar
          <select value={escolhida} onChange={(e) => setEscolhida(e.target.value)}>
            <option value="">Selecione...</option>
            {livres.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <Button type="button" variant="secondary" className="rb-btn sm" aria-label="Adicionar ordenação" disabled={!escolhida}
          onClick={() => { onChange([...valor, { key: escolhida, dir: "asc" }]); setEscolhida(""); }}>
          Adicionar
        </Button>
      </div>
      <ol className="grid gap-1">
        {valor.map((o, i) => (
          <li key={o.key} className="flex items-center gap-2 rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink">
            <span className="w-6 shrink-0 text-ink/45">{i + 1}º</span>
            <span className="flex-1 truncate" title={label(o.key)}>{label(o.key)}</span>
            <button type="button" className="rb-btn sm rb-btn-ghost" aria-label={`${label(o.key)}: ${o.dir === "asc" ? "crescente" : "decrescente"}`}
              onClick={() => onChange(valor.map((x) => (x.key === o.key ? { ...x, dir: x.dir === "asc" ? "desc" : "asc" } : x)))}>
              {o.dir === "asc" ? "A → Z" : "Z → A"}
            </button>
            <button type="button" className="row-action" aria-label={`Subir ${label(o.key)}`} disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp size={14} /></button>
            <button type="button" className="row-action" aria-label={`Descer ${label(o.key)}`} disabled={i === valor.length - 1} onClick={() => mover(i, 1)}><ArrowDown size={14} /></button>
            <button type="button" className="row-action" style={{ "--c": "var(--bad)" } as React.CSSProperties} aria-label={`Remover ${label(o.key)}`} onClick={() => onChange(valor.filter((x) => x.key !== o.key))}><X size={14} /></button>
          </li>
        ))}
      </ol>
    </div>
  );
}
