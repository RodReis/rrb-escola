"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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

      {/* Board */}
      <PipelineBoard
        data={boardData}
        filtros={filtros}
        onOpenCard={setOpenCardId}
        onNovoCard={setCriarColunaId}
      />

      {/* Modal detalhe */}
      <CardModal
        cardId={openCardId}
        onClose={() => setOpenCardId(null)}
        onDeleted={handleCardDeleted}
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
