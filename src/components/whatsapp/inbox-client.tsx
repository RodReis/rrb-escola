"use client";

import { useState, useEffect, useCallback } from "react";
import type { ConversaResumo, MensagemThread } from "@/lib/data/inbox";
import { ConversaLista } from "./conversa-lista";
import { ConversaThread } from "./conversa-thread";
import { marcarLidaAction } from "@/lib/actions/whatsapp-inbox";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Filtro = "todas" | "minhas" | "nao_lidas";

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

export function InboxClient({
  conversasIniciais,
  perfilId,
}: {
  conversasIniciais: ConversaResumo[];
  perfilId: string;
}) {
  const [conversas, setConversas] = useState<ConversaResumo[]>(conversasIniciais);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<ConversaResumo | null>(null);
  const [mensagens, setMensagens] = useState<MensagemThread[]>([]);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);

  const abrir = useCallback(async (c: ConversaResumo) => {
    setSelecionada(c);
    setCarregandoMsgs(true);
    try {
      const res = await fetch(`/api/whatsapp/conversa/${c.id}`);
      if (res.ok) {
        const data = (await res.json()) as MensagemThread[];
        setMensagens(data);
      } else {
        setMensagens([]);
      }
    } catch {
      setMensagens([]);
    } finally {
      setCarregandoMsgs(false);
    }
    void marcarLidaAction(c.id);
    setConversas((prev) =>
      prev.map((p) => (p.id === c.id ? { ...p, nao_lidas: 0 } : p)),
    );
  }, []);

  const recarregarMensagens = useCallback(async (conversaId: string) => {
    try {
      const res = await fetch(`/api/whatsapp/conversa/${conversaId}`);
      if (res.ok) {
        const data = (await res.json()) as MensagemThread[];
        setMensagens(data);
      }
    } catch {
      // silently fail — realtime will retry on next event
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();

    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_conversa" },
        (payload: RealtimePayload) => {
          const raw = payload.new;
          if (!raw?.id) return;
          const updated = raw as Partial<ConversaResumo> & { id: string };
          setConversas((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            if (payload.eventType === "DELETE") {
              return prev.filter(
                (c) => c.id !== (payload.old?.id as string),
              );
            }
            if (exists) {
              return prev.map((c) =>
                c.id === updated.id ? { ...c, ...updated } : c,
              );
            }
            return [updated as ConversaResumo, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pipeline_conversa_mensagem",
        },
        (payload: RealtimePayload) => {
          const nova = payload.new as MensagemThread & { conversa_id: string };
          setSelecionada((sel) => {
            if (sel && nova.conversa_id === sel.id) {
              setMensagens((prev) => {
                if (prev.some((m) => m.id === nova.id)) return prev;
                return [...prev, nova];
              });
            }
            return sel;
          });
          setConversas((prev) =>
            prev.map((c) =>
              c.id === nova.conversa_id
                ? {
                    ...c,
                    ultima_msg_em: nova.created_at,
                    ultima_msg_preview:
                      nova.texto ??
                      (nova.tipo === "imagem" ? "📷 Imagem" : null),
                  }
                : c,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const conversasFiltradas = conversas
    .filter((c) => {
      if (filtro === "nao_lidas") return c.nao_lidas > 0;
      if (filtro === "minhas") return c.assigned_to === perfilId;
      return true;
    })
    .filter((c) => {
      if (!busca) return true;
      const q = busca.toLowerCase();
      return (
        c.nome_whatsapp?.toLowerCase().includes(q) ?? c.telefone.includes(q)
      );
    });

  return (
    <div className="flex h-full" style={{ background: "var(--bg)" }}>
      <ConversaLista
        conversas={conversasFiltradas}
        filtro={filtro}
        busca={busca}
        onFiltro={setFiltro}
        onBusca={setBusca}
        selecionadaId={selecionada?.id ?? null}
        onSelecionar={abrir}
      />
      <ConversaThread
        conversa={selecionada}
        mensagens={mensagens}
        carregando={carregandoMsgs}
        onEnviado={() =>
          selecionada && void recarregarMensagens(selecionada.id)
        }
        onAtribuido={(pid) => {
          setSelecionada((prev) =>
            prev ? { ...prev, assigned_to: pid } : prev,
          );
        }}
      />
    </div>
  );
}
