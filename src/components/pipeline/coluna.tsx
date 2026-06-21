"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { SortableCard } from "./card";
import type { PipelineCardResumo, PipelineColuna } from "./types";
import { COR_TOKEN_CLASSES } from "./types";

type Props = {
  coluna: PipelineColuna;
  cards: PipelineCardResumo[];
  onOpenCard: (id: string) => void;
  onNovoCard: (colunaId: string) => void;
};

export function PipelineColumn({ coluna, cards, onOpenCard, onNovoCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });

  const corClasses = coluna.cor ? (COR_TOKEN_CLASSES[coluna.cor] ?? "") : "";
  // bgClass p/ dot e borda do card; textClass p/ count
  const bgClass = corClasses.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-[rgb(var(--color-ink)/0.15)]";
  const textClass = corClasses.split(" ").find((c) => c.startsWith("text-")) ?? "text-[rgb(var(--color-ink)/0.5)]";

  // Borda superior do card (border-t-2 requer classe de cor de border, não bg)
  // Convertemos "bg-[rgb(var(--color-pipeline-xxx))]" → "border-[rgb(var(--color-pipeline-xxx))]"
  const corBorda = bgClass.replace(/^bg-/, "border-");

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Header da coluna */}
      <div className={cn(
        "mb-2 flex items-center justify-between rounded-t-lg px-3 py-2",
        "border border-b-0 border-[rgb(var(--color-line))]",
        "bg-[rgb(var(--color-surface))]",
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {/* Dot colorido */}
          <span className={cn("h-2 w-2 shrink-0 rounded-full", bgClass)} aria-hidden />

          <h3 className="truncate text-[13px] font-semibold text-[rgb(var(--color-ink))]">
            {coluna.nome}
          </h3>

          {/* Count com pill */}
          <span className={cn(
            "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5",
            "text-[10px] font-bold",
            bgClass,
            textClass,
          )}>
            {cards.length}
          </span>
        </div>

        <button
          type="button"
          aria-label={`Novo card em ${coluna.nome}`}
          onClick={() => onNovoCard(coluna.id)}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md shrink-0 ml-2",
            "text-[rgb(var(--color-ink)/0.35)]",
            "hover:bg-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-ink))]",
            "transition-colors duration-100",
          )}
        >
          <Plus size={13} strokeWidth={2.5} />
        </button>
      </div>

      {/* Área droppable */}
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex flex-col gap-2 rounded-b-lg p-2",
            "border border-t-0 border-[rgb(var(--color-line))]",
            "min-h-[160px] transition-colors duration-150",
            isOver
              ? "bg-[rgb(var(--color-brand)/0.05)] ring-1 ring-inset ring-[rgb(var(--color-brand)/0.25)]"
              : "bg-[rgb(var(--color-paper))]",
          )}
        >
          {cards.length === 0 && !isOver && (
            <div className="flex flex-col items-center justify-center py-6 gap-1">
              <div className={cn("h-7 w-7 rounded-full opacity-20", bgClass)} />
              <p className="text-[11px] text-[rgb(var(--color-ink)/0.3)]">
                Nenhum card
              </p>
            </div>
          )}
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              corBorda={corBorda}
              onOpen={onOpenCard}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
