"use client";

import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, MessageSquare, ArrowRight } from "lucide-react";
import {
  getCardDetalhe,
  getTimelineCard,
  criarNotaAction,
  editarCardAction,
  editarLeadAction,
  excluirCardAction,
  getTemplatesWhatsapp,
  getTarefasCard,
  getUsuariosDaEscola,
  type TemplateWpp,
  type Tarefa,
} from "@/lib/actions/pipeline";
import { STATUS_LEAD, ORIGENS_LEAD } from "@/lib/validation/pipeline";
import { STATUS_LEAD_LABEL, ORIGEM_LABEL } from "./types";
import { ReservaSection } from "./reserva-section";
import { DadosEducacionaisSection } from "./dados-educacionais-section";
import { WhatsappSection } from "./whatsapp-section";
import { TarefasSection } from "./tarefas-section";
import { cn } from "@/lib/utils";

type Props = {
  cardId: string | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
};

type CardDetalhe = Awaited<ReturnType<typeof getCardDetalhe>>;
type Timeline = Awaited<ReturnType<typeof getTimelineCard>>;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CardModal({ cardId, onClose, onDeleted }: Props) {
  const [detalhe, setDetalhe] = useState<CardDetalhe | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [templates, setTemplates] = useState<TemplateWpp[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [perfis, setPerfis] = useState<{ id: string; nome: string }[]>([]);
  const [nota, setNota] = useState("");
  const [isPending, startTransition] = useTransition();
  const [erroNota, setErroNota] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [camposEdit, setCamposEdit] = useState({ status_lead: "", origem: "", motivo_perda: "" });

  useEffect(() => {
    if (!cardId) return;
    setDetalhe(null);
    setTimeline(null);
    setTarefas([]);
    setNota("");
    setErroNota(null);
    setEditando(false);

    Promise.all([
      getCardDetalhe(cardId),
      getTimelineCard(cardId),
      getTemplatesWhatsapp(),
      getTarefasCard(cardId),
      getUsuariosDaEscola(),
    ]).then(([d, t, tmpl, taref, prfs]) => {
      setDetalhe(d);
      setTimeline(t);
      if (tmpl.ok) setTemplates(tmpl.data);
      if (taref.ok) setTarefas(taref.data);
      setPerfis(prfs);
      if (d.ok && d.data.card) {
        setCamposEdit({
          status_lead: d.data.card.status_lead,
          origem: d.data.card.origem ?? "",
          motivo_perda: d.data.card.motivo_perda ?? "",
        });
      }
    });
  }, [cardId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmitNota(e: React.FormEvent) {
    e.preventDefault();
    if (!cardId || !nota.trim()) return;
    setErroNota(null);
    startTransition(async () => {
      const result = await criarNotaAction({
        card_id: cardId,
        descricao: nota.trim(),
        tipo: "nota",
      });
      if (result.ok) {
        setNota("");
        const t = await getTimelineCard(cardId);
        setTimeline(t);
      } else {
        setErroNota(result.error);
      }
    });
  }

  function handleSalvarEdicao() {
    if (!cardId) return;
    startTransition(async () => {
      await editarCardAction(cardId, {
        status_lead: camposEdit.status_lead as (typeof STATUS_LEAD)[number],
        origem: camposEdit.origem as (typeof ORIGENS_LEAD)[number] || null,
        motivo_perda: camposEdit.motivo_perda || null,
      });
      const d = await getCardDetalhe(cardId);
      setDetalhe(d);
      setEditando(false);
    });
  }

  function handleExcluir() {
    if (!cardId) return;
    startTransition(async () => {
      const r = await excluirCardAction(cardId);
      if (r.ok) {
        onDeleted(cardId);
        onClose();
      }
    });
  }

  if (!cardId || typeof window === "undefined") return null;

  const card = detalhe?.ok ? detalhe.data.card : null;
  const lead = detalhe?.ok ? detalhe.data.lead : null;
  const responsaveis = detalhe?.ok ? detalhe.data.responsaveis : [];
  const reserva = detalhe?.ok ? detalhe.data.reserva : null;
  const movs = timeline?.ok ? timeline.data.movimentacoes : [];
  const ativs = timeline?.ok ? timeline.data.atividades : [];

  // Supabase retorna relações como array em joins; normalizar para objeto
  type MovNorm = {
    id: string; created_at: string; observacao: string | null;
    _tipo: "movimentacao";
    de_coluna: { nome: string } | null;
    para_coluna: { nome: string } | null;
    usuario: { nome: string } | null;
  };
  type AtivNorm = {
    id: string; created_at: string; tipo: string; descricao: string | null; anexo_url: string | null;
    _tipo: "atividade";
    usuario: { nome: string } | null;
  };

  function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null;
    if (Array.isArray(v)) return v[0] ?? null;
    return v;
  }

  const timelineItems: (MovNorm | AtivNorm)[] = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...movs.map((m: any): MovNorm => ({
      id: m.id, created_at: m.created_at, observacao: m.observacao,
      _tipo: "movimentacao",
      de_coluna: firstOrNull(m.de_coluna),
      para_coluna: firstOrNull(m.para_coluna),
      usuario: firstOrNull(m.usuario),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...ativs.map((a: any): AtivNorm => ({
      id: a.id, created_at: a.created_at, tipo: a.tipo,
      descricao: a.descricao, anexo_url: a.anexo_url,
      _tipo: "atividade",
      usuario: firstOrNull(a.usuario),
    })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-end p-4 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do card"
        className="relative flex h-full w-full max-w-lg flex-col rounded-xl border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[rgb(var(--color-line))] px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[rgb(var(--color-ink))]">
              {lead?.nome ?? card?.titulo ?? "Carregando…"}
            </p>
            {card && (
              <p className="mt-0.5 text-xs text-[rgb(var(--color-ink)/0.5)]">
                {STATUS_LEAD_LABEL[card.status_lead] ?? card.status_lead}
                {card.origem ? ` · ${ORIGEM_LABEL[card.origem] ?? card.origem}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[rgb(var(--color-ink)/0.4)] hover:bg-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-ink))]"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {!detalhe && (
            <p className="text-sm text-[rgb(var(--color-ink)/0.5)] animate-pulse">Carregando…</p>
          )}

          {/* Lead */}
          {lead && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
                Dados do Interessado
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-[rgb(var(--color-ink)/0.55)]">Nome</span>
                <span className="font-medium text-[rgb(var(--color-ink))]">{lead.nome}</span>
                {lead.data_nascimento && (
                  <>
                    <span className="text-[rgb(var(--color-ink)/0.55)]">Nascimento</span>
                    <span>{new Date(lead.data_nascimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                  </>
                )}
                {lead.serie_interesse && (
                  <>
                    <span className="text-[rgb(var(--color-ink)/0.55)]">Série interesse</span>
                    <span>{lead.serie_interesse}</span>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Responsáveis */}
          {responsaveis.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
                Responsáveis
              </h4>
              <div className="space-y-2">
                {responsaveis.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-[rgb(var(--color-line))] p-3 text-sm"
                  >
                    <p className="font-medium text-[rgb(var(--color-ink))]">
                      {r.nome}
                      {r.parentesco && (
                        <span className="ml-2 text-xs font-normal text-[rgb(var(--color-ink)/0.5)]">
                          {r.parentesco}
                        </span>
                      )}
                    </p>
                    {r.whatsapp && (
                      <p className="mt-0.5 text-xs text-[rgb(var(--color-ink)/0.6)]">{r.whatsapp}</p>
                    )}
                    {r.email && (
                      <p className="text-xs text-[rgb(var(--color-ink)/0.6)]">{r.email}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Dados Educacionais */}
          {lead && cardId && (
            <DadosEducacionaisSection
              cardId={cardId}
              lead={lead}
              onSave={async (data) => {
                const r = await editarLeadAction(cardId, data);
                if (!r.ok) throw new Error(r.error);
                const d = await getCardDetalhe(cardId);
                setDetalhe(d);
              }}
            />
          )}

          {/* Reserva */}
          {cardId && card?.status_lead !== "convertido" && (
            <ReservaSection
              cardId={cardId}
              reserva={reserva}
              onUpdated={async () => {
                const d = await getCardDetalhe(cardId);
                setDetalhe(d);
              }}
            />
          )}

          {/* WhatsApp */}
          {cardId && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
                WhatsApp
              </h4>
              <WhatsappSection
                cardId={cardId}
                templates={templates}
                atividades={ativs.map((a) => ({
                  id: (a as { id: string }).id,
                  tipo: (a as { tipo: string }).tipo,
                  descricao: (a as { descricao: string | null }).descricao ?? "",
                  created_at: (a as { created_at: string }).created_at,
                }))}
                onUpdated={async () => {
                  const [t] = await Promise.all([getTimelineCard(cardId)]);
                  setTimeline(t);
                }}
              />
            </section>
          )}

          {/* Tarefas */}
          {cardId && (
            <section>
              <TarefasSection
                cardId={cardId}
                tarefas={tarefas}
                perfis={perfis}
                onUpdated={async () => {
                  const taref = await getTarefasCard(cardId);
                  if (taref.ok) setTarefas(taref.data);
                }}
              />
            </section>
          )}

          {/* Edição rápida */}
          {card && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
                  Status e Origem
                </h4>
                <button
                  type="button"
                  onClick={() => setEditando((v) => !v)}
                  className="text-xs text-[rgb(var(--color-brand))] hover:underline"
                >
                  {editando ? "Cancelar" : "Editar"}
                </button>
              </div>
              {editando ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Status</label>
                    <select
                      value={camposEdit.status_lead}
                      onChange={(e) => setCamposEdit((p) => ({ ...p, status_lead: e.target.value }))}
                      className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]"
                    >
                      {STATUS_LEAD.map((s) => (
                        <option key={s} value={s}>{STATUS_LEAD_LABEL[s] ?? s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Origem</label>
                    <select
                      value={camposEdit.origem}
                      onChange={(e) => setCamposEdit((p) => ({ ...p, origem: e.target.value }))}
                      className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]"
                    >
                      <option value="">— Nenhuma —</option>
                      {ORIGENS_LEAD.map((o) => (
                        <option key={o} value={o}>{ORIGEM_LABEL[o] ?? o}</option>
                      ))}
                    </select>
                  </div>
                  {camposEdit.status_lead === "perdido" && (
                    <div>
                      <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Motivo da perda</label>
                      <input
                        type="text"
                        value={camposEdit.motivo_perda}
                        onChange={(e) => setCamposEdit((p) => ({ ...p, motivo_perda: e.target.value }))}
                        className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]"
                        placeholder="Ex: sem vaga, desistiu, concorrente…"
                      />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSalvarEdicao}
                      disabled={isPending}
                      className="rounded-md bg-[rgb(var(--color-brand))] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <span className="rounded px-2 py-0.5 text-xs bg-[rgb(var(--color-muted))] text-[rgb(var(--color-ink))]">
                    {STATUS_LEAD_LABEL[card.status_lead] ?? card.status_lead}
                  </span>
                  {card.origem && (
                    <span className="rounded px-2 py-0.5 text-xs bg-[rgb(var(--color-muted))] text-[rgb(var(--color-ink))]">
                      {ORIGEM_LABEL[card.origem] ?? card.origem}
                    </span>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Timeline */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
              Timeline
            </h4>
            {timelineItems.length === 0 && !timeline && (
              <p className="text-xs text-[rgb(var(--color-ink)/0.4)] animate-pulse">Carregando…</p>
            )}
            {timelineItems.length === 0 && timeline && (
              <p className="text-xs text-[rgb(var(--color-ink)/0.4)]">Nenhuma atividade ainda.</p>
            )}
            <div className="space-y-3">
              {timelineItems.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-muted))]">
                    {item._tipo === "movimentacao" ? (
                      <ArrowRight size={10} className="text-[rgb(var(--color-ink)/0.5)]" />
                    ) : (
                      <MessageSquare size={10} className="text-[rgb(var(--color-ink)/0.5)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {item._tipo === "movimentacao" ? (
                      <p className="text-xs text-[rgb(var(--color-ink)/0.6)]">
                        Movido
                        {item.de_coluna?.nome ? ` de "${item.de_coluna.nome}"` : ""}
                        {" "}para{" "}
                        <span className="font-medium text-[rgb(var(--color-ink))]">
                          {item.para_coluna?.nome ?? "?"}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-[rgb(var(--color-ink))] whitespace-pre-wrap break-words">
                        {item.descricao}
                      </p>
                    )}
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[10px] text-[rgb(var(--color-ink)/0.4)]">
                        {formatDate(item.created_at)}
                      </span>
                      {item.usuario?.nome && (
                        <span className="text-[10px] text-[rgb(var(--color-ink)/0.4)]">
                          · {item.usuario.nome}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer: nota + excluir */}
        <div className="border-t border-[rgb(var(--color-line))] px-5 py-4 space-y-3">
          <form onSubmit={handleSubmitNota} className="flex gap-2">
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Adicionar nota interna…"
              className="flex-1 rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-3 py-1.5 text-sm text-[rgb(var(--color-ink))] placeholder:text-[rgb(var(--color-ink)/0.35)] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-brand)/0.5)]"
            />
            <button
              type="submit"
              disabled={isPending || !nota.trim()}
              className="rounded-md bg-[rgb(var(--color-brand))] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              Salvar
            </button>
          </form>
          {erroNota && (
            <p className="text-xs text-[rgb(var(--color-danger))]">{erroNota}</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleExcluir}
              disabled={isPending}
              className={cn(
                "text-xs text-[rgb(var(--color-danger)/0.6)] hover:text-[rgb(var(--color-danger))] hover:underline disabled:opacity-40",
              )}
            >
              Excluir card
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
