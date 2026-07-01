"use client";

import type { ConversaResumo } from "@/lib/data/inbox";
import { VinculoChip } from "./vinculo-chip";
import { Search } from "lucide-react";

type Filtro = "todas" | "minhas" | "nao_lidas";

type Props = {
  conversas: ConversaResumo[];
  filtro: Filtro;
  busca: string;
  onFiltro: (f: Filtro) => void;
  onBusca: (b: string) => void;
  selecionadaId: string | null;
  onSelecionar: (c: ConversaResumo) => void;
};

function formatHora(iso: string): string {
  const d = new Date(iso);
  const agora = new Date();
  const diffMs = agora.getTime() - d.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDias === 0) {
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDias === 1) return "ontem";
  if (diffDias < 7) {
    return d.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "minhas", label: "Minhas" },
  { key: "nao_lidas", label: "Não lidas" },
];

export function ConversaLista({
  conversas,
  filtro,
  busca,
  onFiltro,
  onBusca,
  selecionadaId,
  onSelecionar,
}: Props) {
  return (
    <aside
      className="flex h-full w-[320px] shrink-0 flex-col border-r"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 border-b px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <h1
          className="mb-2 text-[15px] font-semibold"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text)",
          }}
        >
          WhatsApp Inbox
        </h1>

        {/* Busca */}
        <div
          className="relative mb-2 flex items-center rounded-[var(--r-sm)] border px-2.5 py-1.5"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <Search
            size={13}
            style={{ color: "var(--text-muted)" }}
            className="mr-2 shrink-0"
          />
          <input
            type="search"
            placeholder="Buscar conversa..."
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-faint)]"
            style={{ color: "var(--text)" }}
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-1">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onFiltro(f.key)}
              className="rounded-[var(--r-pill)] px-2.5 py-0.5 text-[11.5px] font-medium transition-colors"
              style={
                filtro === f.key
                  ? { background: "var(--brand-600)", color: "#fff" }
                  : {
                      background: "var(--surface-3)",
                      color: "var(--text-muted)",
                    }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {conversas.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center text-[13px]"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="mb-2 text-2xl">💬</span>
            Nenhuma conversa encontrada
          </div>
        ) : (
          conversas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelecionar(c)}
              className="w-full cursor-pointer border-b px-4 py-3 text-left transition-colors"
              style={{
                borderColor: "var(--border-soft)",
                background:
                  selecionadaId === c.id
                    ? "color-mix(in oklab, var(--brand-600) 8%, var(--surface))"
                    : "transparent",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="truncate text-[13px] font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {c.nome_whatsapp ?? c.telefone}
                    </span>
                    {c.nao_lidas > 0 && (
                      <span
                        className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                        style={{ background: "var(--brand-600)" }}
                      >
                        {c.nao_lidas > 99 ? "99+" : c.nao_lidas}
                      </span>
                    )}
                  </div>
                  {c.nome_whatsapp && (
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {c.telefone}
                    </div>
                  )}
                  <p
                    className="mt-0.5 truncate text-[12px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {c.ultima_msg_preview ?? ""}
                  </p>
                  <div className="mt-1">
                    <VinculoChip
                      lead_id={c.lead_id}
                      aluno_id={c.aluno_id}
                      responsavel_id={c.responsavel_id}
                    />
                  </div>
                </div>
                <div
                  className="shrink-0 text-[11px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {formatHora(c.ultima_msg_em)}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
