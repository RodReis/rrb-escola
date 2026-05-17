"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, AlertCircle, AlertTriangle, Info, Check, CheckCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { markAllNotificacoesLidasAction, markNotificacaoLidaAction } from "@/lib/actions/notificacoes";
import type { NotificacaoRow, NotificacaoSeveridade } from "@/lib/data/notificacoes";

const ICONS: Record<NotificacaoSeveridade, typeof AlertCircle> = {
  critico: AlertCircle,
  atencao: AlertTriangle,
  info: Info,
};

const COLORS: Record<NotificacaoSeveridade, string> = {
  critico: "text-danger bg-danger/10",
  atencao: "text-warning bg-warning/10",
  info: "text-brand bg-brand/10",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

type Props = {
  perfilId: string;
  escolaId: string;
  initial: NotificacaoRow[];
};

export function NotificationBell({ perfilId, escolaId, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<NotificacaoRow[]>(initial);
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const naoLidas = items.filter((n) => !n.lida).length;

  // Realtime subscription
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`notificacoes_${perfilId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes" },
        (payload) => {
          const n = payload.new as any;
          if (n.escola_id !== escolaId) return;
          if (n.perfil_id !== null && n.perfil_id !== perfilId) return;

          const row: NotificacaoRow = {
            id: n.id,
            tipo: n.tipo,
            titulo: n.titulo,
            descricao: n.descricao,
            href: n.href,
            severidade: n.severidade,
            lida: false,
            criadaEm: n.criada_em,
          };
          setItems((prev) => [row, ...prev].slice(0, 50));
          setPulse(true);
          setTimeout(() => setPulse(false), 1500);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notificacoes" },
        (payload) => {
          const n = payload.new as any;
          setItems((prev) =>
            prev.map((p) => (p.id === n.id ? { ...p, lida: !!n.lida } : p))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [perfilId, escolaId]);

  // Click fora fecha
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function handleMarkRead(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, lida: true } : p)));
    await markNotificacaoLidaAction(fd);
  }

  async function handleClick(n: NotificacaoRow) {
    if (!n.lida) await handleMarkRead(n.id);
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  async function handleMarkAll() {
    setItems((prev) => prev.map((p) => ({ ...p, lida: true })));
    await markAllNotificacoesLidasAction();
  }

  const Icon = pulse ? BellRing : Bell;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border border-white/[0.12] bg-white/10 text-white hover:bg-white/[0.18]"
        aria-label="Notificações"
      >
        <Icon size={13} strokeWidth={pulse ? 2 : 1.8} className={pulse ? "animate-pulse" : ""} />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#ff3344] px-1 text-[9px] font-bold text-white shadow-[0_0_0_1.5px_#15349E]">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-surface shadow-lift overflow-hidden z-50">
          <div className="flex items-center justify-between border-b border-line p-3">
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
              Notificações {naoLidas > 0 && <span className="text-brand">({naoLidas})</span>}
            </p>
            {naoLidas > 0 && (
              <button
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <CheckCheck size={12} /> Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink/60">Nenhuma notificação.</p>
            ) : (
              <ul>
                {items.map((n) => {
                  const I = ICONS[n.severidade];
                  return (
                    <li
                      key={n.id}
                      className={`border-b border-line/60 last:border-0 ${n.lida ? "bg-surface" : "bg-brand/5"}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleClick(n)}
                        className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/60"
                      >
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-ui ${COLORS[n.severidade]}`}>
                          <I size={14} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`truncate text-sm ${n.lida ? "font-medium text-ink/70" : "font-bold text-ink"}`}>
                            {n.titulo}
                          </p>
                          {n.descricao && (
                            <p className="text-xs text-ink/60 line-clamp-2">{n.descricao}</p>
                          )}
                          <p className="mt-1 text-[0.66rem] uppercase tracking-kicker text-ink/40">
                            {timeAgo(n.criadaEm)}
                          </p>
                        </div>
                        {!n.lida && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
