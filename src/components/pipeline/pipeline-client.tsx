"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { checkTarefasVencidasAction } from "@/lib/actions/pipeline";
import { PipelineBoard } from "./board";
import { CardModal } from "./card-modal";
import { CriarCardModal } from "./criar-card-modal";
import { PipelineFiltros, type FiltrosPipeline } from "./filtros";
import type { PipelineBoardData, PipelineCardResumo } from "./types";

type Usuario = { id: string; nome: string };

type Props = {
  data: PipelineBoardData;
  usuarios: Usuario[];
  escolaId: string;
};

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

export function PipelineClient({ data, usuarios, escolaId }: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shadowLeft, setShadowLeft] = useState(false);
  const [shadowRight, setShadowRight] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);     // 0..1 posição do scroll
  const [thumbPct, setThumbPct] = useState(1);        // largura da barra (0..1)
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [criarColunaId, setCriarColunaId] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosPipeline>({
    nome: "",
    colunaId: "",
    assignedTo: "",
    semResposta: false,
  });

  useEffect(() => {
    void checkTarefasVencidasAction();
  }, []);

  // Indicadores de overflow lateral + barra de progresso do scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      setShadowLeft(el.scrollLeft > 8);
      setShadowRight(el.scrollLeft < maxScroll - 8);
      setThumbPct(el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1);
      setScrollPct(maxScroll > 0 ? el.scrollLeft / maxScroll : 0);
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);

  const hasOverflow = thumbPct < 0.999;

  // Scroll por clique nas setas (~1.5 coluna por clique)
  const scrollBy = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -440 : 440, behavior: "smooth" });
  }, []);
  const [boardData, setBoardData] = useState<PipelineBoardData>(data);

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`pipeline:${boardData.quadro.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipeline_card",
          filter: `escola_id=eq.${escolaId}`,
        },
        (payload: RealtimePayload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id as string;
            setBoardData((prev) => ({
              ...prev,
              cards: prev.cards.filter((c) => c.id !== deletedId),
            }));
            return;
          }
          const raw = payload.new;
          if ((raw.quadro_id as string) !== boardData.quadro.id) return;

          const updated: Partial<PipelineCardResumo> = {
            id: raw.id as string,
            coluna_id: raw.coluna_id as string,
            ordem: raw.ordem as number,
            titulo: raw.titulo as string,
            origem: raw.origem as string | null,
            status_lead: raw.status_lead as string,
            assigned_to: raw.assigned_to as string | null,
            ultimo_contato_at: raw.ultimo_contato_at as string | null,
            created_at: raw.created_at as string,
            etiqueta_cor: (raw.etiqueta_cor as PipelineCardResumo["etiqueta_cor"]) ?? null,
            etiqueta_label: (raw.etiqueta_label as string | null) ?? null,
          };

          setBoardData((prev) => ({
            ...prev,
            cards: prev.cards.some((c) => c.id === updated.id)
              ? prev.cards.map((c) =>
                  c.id === updated.id ? { ...c, ...updated } : c,
                )
              : [...prev.cards, updated as PipelineCardResumo],
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [boardData.quadro.id, escolaId]);

  const handleCardDeleted = useCallback((id: string) => {
    setBoardData((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== id),
    }));
  }, []);

  const handleCardCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <>
      {/* Header do board */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[rgb(var(--color-ink))]">
            {boardData.quadro.nome}
          </h1>
          <p className="text-xs text-[rgb(var(--color-ink)/0.45)]">
            {boardData.cards.length} card{boardData.cards.length !== 1 ? "s" : ""}
          </p>
        </div>
        <PipelineFiltros
          filtros={filtros}
          onChange={setFiltros}
          colunas={boardData.colunas}
          usuarios={usuarios}
        />
      </div>

      {/* Board com navegação por overflow */}
      <div className="relative">
        {/* Sombra esquerda */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 transition-opacity duration-200"
          style={{
            opacity: shadowLeft ? 1 : 0,
            background: "linear-gradient(to right, rgb(var(--color-bg)) 20%, transparent)",
          }}
        />
        {/* Seta esquerda — ancorada na faixa dos headers de coluna */}
        <button
          type="button"
          onClick={() => scrollBy("left")}
          aria-label="Ver colunas à esquerda"
          tabIndex={shadowLeft ? 0 : -1}
          className={`absolute left-0 top-9 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-ink)/0.65)] shadow-[0_2px_8px_rgba(0,0,0,.12)] transition-all duration-200 hover:bg-[rgb(var(--color-brand))] hover:text-white hover:border-transparent active:scale-90 ${
            shadowLeft ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>

        {/* Sombra direita */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 transition-opacity duration-200"
          style={{
            opacity: shadowRight ? 1 : 0,
            background: "linear-gradient(to left, rgb(var(--color-bg)) 20%, transparent)",
          }}
        />
        {/* Seta direita */}
        <button
          type="button"
          onClick={() => scrollBy("right")}
          aria-label="Ver colunas à direita"
          tabIndex={shadowRight ? 0 : -1}
          className={`absolute right-0 top-9 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-ink)/0.65)] shadow-[0_2px_8px_rgba(0,0,0,.12)] transition-all duration-200 hover:bg-[rgb(var(--color-brand))] hover:text-white hover:border-transparent active:scale-90 ${
            shadowRight ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>

        <PipelineBoard
          data={boardData}
          filtros={filtros}
          onOpenCard={setOpenCardId}
          onNovoCard={setCriarColunaId}
          scrollRef={scrollRef}
        />
      </div>

      {/* Barra de progresso do scroll — comunica quantas colunas há e a posição */}
      {hasOverflow && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <div className="relative h-1.5 w-48 overflow-hidden rounded-full bg-[rgb(var(--color-ink)/0.08)]">
            <div
              className="absolute top-0 h-full rounded-full bg-[rgb(var(--color-brand)/0.6)] transition-[left] duration-150 ease-out"
              style={{
                width: `${Math.max(thumbPct * 100, 12)}%`,
                left: `${scrollPct * (100 - Math.max(thumbPct * 100, 12))}%`,
              }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-[rgb(var(--color-ink)/0.45)]">
            {boardData.colunas.length} colunas
          </span>
        </div>
      )}

      {/* Modal detalhe */}
      <CardModal
        cardId={openCardId}
        onClose={() => setOpenCardId(null)}
        onDeleted={handleCardDeleted}
        onUpdated={() => router.refresh()}
      />

      {/* Modal criar */}
      {criarColunaId && (
        <CriarCardModal
          quadroId={boardData.quadro.id}
          colunaId={criarColunaId}
          onClose={() => setCriarColunaId(null)}
          onCreated={handleCardCreated}
        />
      )}
    </>
  );
}
