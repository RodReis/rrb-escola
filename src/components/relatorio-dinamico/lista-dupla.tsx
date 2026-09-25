"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { normalizarTexto } from "@/lib/relatorio-dinamico/formatar";
import type { ColunaMeta } from "@/lib/relatorio-dinamico/tipos";

type Props = { disponiveis: ColunaMeta[]; selecionadas: string[]; onChange: (keys: string[]) => void };

const contagem = (n: number) => (n === 0 ? "Nenhum item selecionado" : n === 1 ? "1 item selecionado" : `${n} itens selecionados`);
const filtra = (cols: ColunaMeta[], busca: string) => {
  const b = normalizarTexto(busca);
  return b ? cols.filter((c) => normalizarTexto(c.label).includes(b)) : cols;
};

function Painel({ titulo, busca, onBusca, itens, marcados, onMarcados, onDuplo, rotuloBusca, ordenavel }: {
  titulo: string; busca: string; onBusca: (s: string) => void; itens: ColunaMeta[]; marcados: Set<string>;
  onMarcados: (s: Set<string>) => void; onDuplo: (key: string) => void; rotuloBusca: string; ordenavel?: boolean;
}) {
  const todos = itens.length > 0 && itens.every((i) => marcados.has(i.key));
  const alternar = (key: string) => {
    const s = new Set(marcados);
    if (s.has(key)) s.delete(key); else s.add(key);
    onMarcados(s);
  };
  const colsGrid = ordenavel ? "grid-cols-[16px_16px_1fr]" : "grid-cols-[16px_1fr_96px]";
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex items-center justify-between gap-3 rounded-t-ui border border-b-0 border-line bg-muted px-3 py-2.5">
        <label className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wide text-ink/60">
          <input type="checkbox" className="h-4 w-4 shrink-0 accent-brand" checked={todos} onChange={() => onMarcados(todos ? new Set() : new Set(itens.map((i) => i.key)))} aria-label={`Marcar todos: ${titulo}`} />
          {titulo}
        </label>
        <span className="shrink-0 text-xs font-medium text-ink/50">{contagem(marcados.size)}</span>
      </div>
      <input aria-label={rotuloBusca} placeholder="Pesquisar" value={busca} onChange={(e) => onBusca(e.target.value)} className="-mt-2" />
      <ul className="h-64 overflow-y-auto rounded-b-ui border border-line">
        {itens.length === 0 ? <li className="p-4 text-center text-sm text-ink/55">Não há nada para mostrar aqui</li> : null}
        {itens.map((item) =>
          ordenavel ? (
            <ItemOrdenavel key={item.key} item={item} marcado={marcados.has(item.key)} onToggle={alternar} onDuplo={onDuplo} colsGrid={colsGrid} />
          ) : (
            <li key={item.key} onDoubleClick={() => onDuplo(item.key)}
              className={`grid ${colsGrid} items-center gap-3 border-b border-line/60 px-3 py-2 text-sm text-ink last:border-b-0 hover:bg-muted/60`}>
              <input type="checkbox" className="h-4 w-4 shrink-0 accent-brand" aria-label={item.label} checked={marcados.has(item.key)} onChange={() => alternar(item.key)} />
              <span className="truncate" title={item.label}>{item.label}</span>
              <span className="shrink-0 text-right text-xs text-ink/45">{item.grupo}</span>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

function ItemOrdenavel({ item, marcado, onToggle, onDuplo, colsGrid }: { item: ColunaMeta; marcado: boolean; onToggle: (k: string) => void; onDuplo: (k: string) => void; colsGrid: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.key });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} onDoubleClick={() => onDuplo(item.key)}
      className={`grid ${colsGrid} items-center gap-3 border-b border-line/60 bg-surface px-3 py-2 text-sm text-ink last:border-b-0 hover:bg-muted/60`}>
      <button type="button" aria-label={`Arrastar ${item.label}`} className="cursor-grab text-ink/40" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      <input type="checkbox" className="h-4 w-4 shrink-0 accent-brand" aria-label={item.label} checked={marcado} onChange={() => onToggle(item.key)} />
      <span className="truncate" title={item.label}>{item.label}</span>
    </li>
  );
}

export function ListaDupla({ disponiveis, selecionadas, onChange }: Props) {
  const [buscaEsq, setBuscaEsq] = useState("");
  const [buscaDir, setBuscaDir] = useState("");
  const [marcEsq, setMarcEsq] = useState<Set<string>>(new Set());
  const [marcDir, setMarcDir] = useState<Set<string>>(new Set());
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const porKey = new Map(disponiveis.map((c) => [c.key, c]));
  const esquerda = filtra(
    disponiveis.filter((c) => !selecionadas.includes(c.key)).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    buscaEsq
  );
  const direita = filtra(selecionadas.map((k) => porKey.get(k)).filter((c): c is ColunaMeta => Boolean(c)), buscaDir);

  const adicionar = (keys: string[]) => {
    onChange([...selecionadas, ...keys.filter((k) => !selecionadas.includes(k))]);
    setMarcEsq(new Set());
  };
  const remover = (keys: string[]) => {
    onChange(selecionadas.filter((k) => !keys.includes(k)));
    setMarcDir(new Set());
  };
  const aoArrastar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(arrayMove(selecionadas, selecionadas.indexOf(String(e.active.id)), selecionadas.indexOf(String(e.over.id))));
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
      <Painel titulo="Dados Disponíveis" rotuloBusca="Pesquisar dados disponíveis" busca={buscaEsq} onBusca={setBuscaEsq}
        itens={esquerda} marcados={marcEsq} onMarcados={setMarcEsq} onDuplo={(k) => adicionar([k])} />
      <div className="flex flex-row items-center justify-center gap-2 md:flex-col">
        <button type="button" aria-label="Adicionar selecionados" className="row-action" disabled={marcEsq.size === 0} onClick={() => adicionar(Array.from(marcEsq))}>
          <ArrowRight size={16} />
        </button>
        <button type="button" aria-label="Remover selecionados" className="row-action" disabled={marcDir.size === 0} onClick={() => remover(Array.from(marcDir))}>
          <ArrowLeft size={16} />
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoArrastar}>
        <SortableContext items={selecionadas} strategy={verticalListSortingStrategy}>
          <Painel titulo="Dados Selecionados" rotuloBusca="Pesquisar dados selecionados" busca={buscaDir} onBusca={setBuscaDir}
            itens={direita} marcados={marcDir} onMarcados={setMarcDir} onDuplo={(k) => remover([k])} ordenavel />
        </SortableContext>
      </DndContext>
    </div>
  );
}
