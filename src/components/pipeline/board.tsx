"use client";

import { useState, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { moverCardAction } from "@/lib/actions/pipeline";
import { calcularOrdem, ordensDeColuna } from "@/lib/pipeline/ordenacao";
import { PipelineColumn } from "./coluna";
import { SortableCard } from "./card";
import type { PipelineBoardData, PipelineCardResumo } from "./types";
import { COR_TOKEN_CLASSES } from "./types";

type Props = {
  data: PipelineBoardData;
  filtros: { nome: string; colunaId: string; assignedTo: string; semResposta: boolean };
  onOpenCard: (id: string) => void;
  onNovoCard: (colunaId: string) => void;
};

export function PipelineBoard({ data, filtros, onOpenCard, onNovoCard }: Props) {
  const [cards, setCards] = useState<PipelineCardResumo[]>(data.cards);
  // Evita processar eventos do Realtime enquanto o usuário draga
  const isDraggingRef = useRef(false);
  const [activeCard, setActiveCard] = useState<PipelineCardResumo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Sincroniza cards novos vindos do Realtime (quando não está draggando)
  const mergeRealtimeCard = useCallback((updated: PipelineCardResumo) => {
    if (isDraggingRef.current) return;
    setCards((prev) =>
      prev.some((c) => c.id === updated.id)
        ? prev.map((c) => (c.id === updated.id ? updated : c))
        : [...prev, updated],
    );
  }, []);

  // Expõe função para o pai usar via ref (Realtime)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (PipelineBoard as any).__mergeRealtime = mergeRealtimeCard;

  function handleDragStart(event: DragStartEvent) {
    isDraggingRef.current = true;
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeCard = cards.find((c) => c.id === activeId);
    if (!activeCard) return;

    // over pode ser um card ou uma coluna (useDroppable)
    const overCard = cards.find((c) => c.id === overId);
    const targetColunaId = overCard ? overCard.coluna_id : overId;

    if (activeCard.coluna_id === targetColunaId) return;

    // Move otimisticamente para nova coluna
    setCards((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, coluna_id: targetColunaId } : c,
      ),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false;
    setActiveCard(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const movedCard = cards.find((c) => c.id === activeId);
    if (!movedCard) return;

    const overCard = cards.find((c) => c.id === overId);
    const targetColunaId = overCard ? overCard.coluna_id : overId;

    const cardsNaColuna = cards.filter(
      (c) => c.coluna_id === targetColunaId && c.id !== activeId,
    );
    const sorted = [...cardsNaColuna].sort((a, b) => a.ordem - b.ordem);

    // Encontra índice de destino
    let indiceDestino = sorted.length;
    if (overCard && overCard.id !== activeId) {
      indiceDestino = sorted.findIndex((c) => c.id === overId);
      if (indiceDestino < 0) indiceDestino = sorted.length;
    }

    const ordens = ordensDeColuna(cards.filter((c) => c.coluna_id === targetColunaId), activeId);
    const novaOrdem = calcularOrdem(ordens, indiceDestino);

    // Atualiza local otimisticamente
    setCards((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, coluna_id: targetColunaId, ordem: novaOrdem }
          : c,
      ),
    );

    const result = await moverCardAction({
      card_id: activeId,
      para_coluna_id: targetColunaId,
      nova_ordem: novaOrdem,
    });

    if (!result.ok) {
      // Rollback
      setCards(data.cards);
      // Toast de erro — componente pai recebe via onError se necessário
      console.error("[Pipeline] Erro ao mover card:", result.error);
    }
  }

  // Filtragem
  const cardsFiltrados = cards.filter((c) => {
    const nome = (c.pipeline_lead?.nome ?? c.titulo).toLowerCase();
    if (filtros.nome && !nome.includes(filtros.nome.toLowerCase())) return false;
    if (filtros.colunaId && c.coluna_id !== filtros.colunaId) return false;
    if (filtros.assignedTo && c.assigned_to !== filtros.assignedTo) return false;
    if (filtros.semResposta && !c.sem_resposta) return false;
    return true;
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x">
        {data.colunas.map((coluna) => {
          const cardsColuna = cardsFiltrados
            .filter((c) => c.coluna_id === coluna.id)
            .sort((a, b) => a.ordem - b.ordem);

          return (
            <div key={coluna.id} className="snap-start">
              <PipelineColumn
                coluna={coluna}
                cards={cardsColuna}
                onOpenCard={onOpenCard}
                onNovoCard={onNovoCard}
              />
            </div>
          );
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(.16,1,.3,1)" }}>
        {activeCard && (() => {
          const coluna = data.colunas.find((c) => c.id === activeCard.coluna_id);
          const corClasses = coluna?.cor ? (COR_TOKEN_CLASSES[coluna.cor] ?? "") : "";
          const bgClass = corClasses.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-[rgb(var(--color-ink)/0.15)]";
          const corBorda = bgClass.replace(/^bg-/, "border-");
          return (
            <div className="rotate-1 w-72 drop-shadow-2xl">
              <SortableCard
                card={activeCard}
                corBorda={corBorda}
                onOpen={() => {}}
              />
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
}
