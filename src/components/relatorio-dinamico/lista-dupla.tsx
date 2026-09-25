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
  return (
    <div className="grid min-w-0 gap-2">
      <label className="flex items-center gap-3 rounded-ui bg-brand px-4 py-3 text-sm font-semibold text-white">
        <input type="checkbox" checked={todos} onChange={() => onMarcados(todos ? new Set() : new Set(itens.map((i) => i.key)))} aria-label={`Marcar todos: ${titulo}`} />
        {titulo}
      </label>
      <input aria-label={rotuloBusca} placeholder="Pesquisar" value={busca} onChange={(e) => onBusca(e.target.value)} />
      <ul className="h-64 overflow-y-auto rounded-ui border border-line bg-muted/40 p-1">
        {itens.length === 0 ? <li className="p-4 text-center text-sm text-ink/55">Não há nada para mostrar aqui</li> : null}
        {itens.map((item) =>
          ordenavel ? (
            <ItemOrdenavel key={item.key} item={item} marcado={marcados.has(item.key)} onToggle={alternar} onDuplo={onDuplo} />
          ) : (
            <li key={item.key} onDoubleClick={() => onDuplo(item.key)} className="mb-1 flex items-center gap-3 rounded-ui bg-surface px-3 py-2 text-sm text-ink odd:bg-muted">
              <input type="checkbox" aria-label={item.label} checked={marcados.has(item.key)} onChange={() => alternar(item.key)} />
              <span className="truncate">{item.label}</span>
              <span className="ml-auto shrink-0 text-xs text-ink/45">{item.grupo}</span>
            </li>
          )
        )}
      </ul>
      <p className="text-right text-xs font-medium text-ink/55">{contagem(marcados.size)}</p>
    </div>
  );
}

function ItemOrdenavel({ item, marcado, onToggle, onDuplo }: { item: ColunaMeta; marcado: boolean; onToggle: (k: string) => void; onDuplo: (k: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.key });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} onDoubleClick={() => onDuplo(item.key)}
      className="mb-1 flex items-center gap-3 rounded-ui bg-surface px-3 py-2 text-sm text-ink odd:bg-muted">
      <button type="button" aria-label={`Arrastar ${item.label}`} className="cursor-grab text-ink/40" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      <input type="checkbox" aria-label={item.label} checked={marcado} onChange={() => onToggle(item.key)} />
      <span className="truncate">{item.label}</span>
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
        <button type="button" aria-label="Adicionar selecionados" className="ds-button ds-button-secondary w-24" disabled={marcEsq.size === 0} onClick={() => adicionar(Array.from(marcEsq))}>
          <ArrowRight size={16} />
        </button>
        <button type="button" aria-label="Remover selecionados" className="ds-button ds-button-secondary w-24" disabled={marcDir.size === 0} onClick={() => remover(Array.from(marcDir))}>
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
