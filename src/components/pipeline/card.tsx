"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { PipelineCardResumo } from "./types";
import { STATUS_LEAD_LABEL, ORIGEM_LABEL } from "./types";

type Props = {
  card: PipelineCardResumo;
  corBorda: string;  // classe Tailwind para a borda superior colorida
  onOpen: (id: string) => void;
};

// Cores semânticas por status (usando tokens do DS)
const STATUS_COLORS: Record<string, string> = {
  novo:       "bg-[rgb(var(--color-brand)/0.1)] text-[rgb(var(--color-brand))]",
  em_analise: "bg-[rgb(var(--color-warning)/0.12)] text-[rgb(var(--color-warning))]",
  reserva:    "bg-[rgb(var(--color-pipeline-reserva)/0.12)] text-[rgb(var(--color-pipeline-reserva))]",
  convertido: "bg-[rgb(var(--color-success)/0.12)] text-[rgb(var(--color-success))]",
  perdido:    "bg-[rgb(var(--color-danger)/0.12)] text-[rgb(var(--color-danger))]",
};

// Cores pastel de avatar (exceção autorizada no CLAUDE.md)
const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
];

function formatDataRelativa(iso: string): string {
  const agora = Date.now();
  const data = new Date(iso).getTime();
  const diff = agora - data;
  const min = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (min < 2) return "agora";
  if (min < 60) return `${min}min`;
  if (h < 24) return `${h}h`;
  if (d === 1) return "ontem";
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}sem`;
  return `${Math.floor(d / 30)}m`;
}

function PipelineCardInner({ card, corBorda, onOpen }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const nomeExibido = card.pipeline_lead?.nome ?? card.titulo;
  const iniciais = nomeExibido
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const avatarClass = AVATAR_COLORS[card.id.charCodeAt(0) % AVATAR_COLORS.length];
  const statusClass = STATUS_COLORS[card.status_lead] ?? "bg-[rgb(var(--color-muted))] text-[rgb(var(--color-ink)/0.6)]";

  const dataRef = card.ultimo_contato_at ?? card.created_at;
  const dataStr = formatDataRelativa(dataRef);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.id)}
      className={cn(
        // base
        "group relative select-none cursor-grab touch-none",
        "rounded-xl border border-[rgb(var(--color-line))]",
        "bg-[rgb(var(--color-surface))]",
        // sombra e lift no hover
        "shadow-[0_1px_3px_rgba(0,0,0,.06),0_1px_2px_rgba(0,0,0,.04)]",
        "hover:shadow-[0_4px_12px_rgba(0,0,0,.1),0_2px_4px_rgba(0,0,0,.06)]",
        "hover:-translate-y-0.5",
        "transition-all duration-150 ease-out",
        // dragging
        isDragging && "opacity-40 shadow-2xl scale-[1.02] cursor-grabbing",
        // borda superior colorida
        "border-t-2",
        corBorda,
      )}
    >
      <div className="p-3">
        {/* Linha superior: avatar + nome + data */}
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              "text-[11px] font-bold tracking-wide",
              "shadow-[0_1px_3px_rgba(0,0,0,.1)]",
              avatarClass,
            )}
            aria-hidden
          >
            {iniciais}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[rgb(var(--color-ink))] leading-snug line-clamp-2">
              {nomeExibido}
            </p>
            {card.pipeline_lead?.data_nascimento && (
              <p className="mt-0.5 text-[11px] text-[rgb(var(--color-ink)/0.45)] tabular-nums">
                {new Date(card.pipeline_lead.data_nascimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              </p>
            )}
          </div>

          {/* Data relativa + indicador sem resposta */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] tabular-nums text-[rgb(var(--color-ink)/0.35)] pt-0.5">
              {dataStr}
            </span>
            {card.sem_resposta && (
              <span
                className="h-2 w-2 rounded-full bg-[rgb(var(--color-danger))]"
                title="Sem contato dentro do prazo"
                aria-label="Sem resposta"
              />
            )}
          </div>
        </div>

        {/* Badges de status e origem */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          {card.status_lead !== "novo" && (
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
              statusClass,
            )}>
              {STATUS_LEAD_LABEL[card.status_lead] ?? card.status_lead}
            </span>
          )}
          {card.origem && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[rgb(var(--color-muted))] text-[rgb(var(--color-ink)/0.55)]">
              {ORIGEM_LABEL[card.origem] ?? card.origem}
            </span>
          )}
        </div>
      </div>

      {/* Linha inferior: indicador de responsável */}
      {card.assigned_to && (
        <div className="border-t border-[rgb(var(--color-line))] px-3 py-1.5 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-success))]" aria-hidden />
          <span className="text-[10px] text-[rgb(var(--color-ink)/0.45)]">Atribuído</span>
        </div>
      )}
    </div>
  );
}

export const SortableCard = memo(PipelineCardInner);
