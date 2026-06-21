"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { criarCardAction } from "@/lib/actions/pipeline";
import { ORIGENS_LEAD, STATUS_LEAD } from "@/lib/validation/pipeline";
import { ORIGEM_LABEL, STATUS_LEAD_LABEL } from "./types";

type Props = {
  quadroId: string;
  colunaId: string;
  onClose: () => void;
  onCreated: () => void;
};

export function CriarCardModal({ quadroId, colunaId, onClose, onCreated }: Props) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    titulo: "",
    origem: "",
    status_lead: "novo",
    lead_nome: "",
    lead_nascimento: "",
    lead_serie: "",
    resp_nome: "",
    resp_parentesco: "",
    resp_whatsapp: "",
    resp_email: "",
  });

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!form.lead_nome.trim()) {
      setErro("Nome do interessado é obrigatório");
      return;
    }
    if (!form.resp_nome.trim()) {
      setErro("Nome do responsável é obrigatório");
      return;
    }

    startTransition(async () => {
      const result = await criarCardAction({
        quadro_id: quadroId,
        coluna_id: colunaId,
        titulo: form.lead_nome.trim(),
        origem: (form.origem as (typeof ORIGENS_LEAD)[number]) || null,
        status_lead: (form.status_lead as (typeof STATUS_LEAD)[number]) ?? "novo",
        lead: {
          nome: form.lead_nome.trim(),
          data_nascimento: form.lead_nascimento || null,
          serie_interesse: form.lead_serie.trim() || null,
        },
        responsaveis: [
          {
            nome: form.resp_nome.trim(),
            parentesco: form.resp_parentesco.trim() || null,
            whatsapp: form.resp_whatsapp.trim() || null,
            email: form.resp_email.trim() || null,
            pedagogico: true,
            financeiro: true,
            autorizado_retirar: false,
          },
        ],
      });

      if (result.ok) {
        onCreated();
        onClose();
      } else {
        setErro(result.error);
      }
    });
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[1px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Novo card"
        className="relative w-full max-w-md rounded-xl border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--color-line))]">
          <p className="text-sm font-semibold text-[rgb(var(--color-ink))]">Novo Card</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--color-ink)/0.4)] hover:bg-[rgb(var(--color-muted))]"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Interessado */}
          <section>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
              Interessado
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.6)] mb-1">
                  Nome <span className="text-[rgb(var(--color-danger))]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.lead_nome}
                  onChange={(e) => set("lead_nome", e.target.value)}
                  className="input-ds"
                  placeholder="Nome do aluno ou interessado"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[rgb(var(--color-ink)/0.6)] mb-1">Nascimento</label>
                  <input
                    type="date"
                    value={form.lead_nascimento}
                    onChange={(e) => set("lead_nascimento", e.target.value)}
                    className="input-ds"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[rgb(var(--color-ink)/0.6)] mb-1">Série interesse</label>
                  <input
                    type="text"
                    value={form.lead_serie}
                    onChange={(e) => set("lead_serie", e.target.value)}
                    className="input-ds"
                    placeholder="Ex: 1º Ano EF"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Responsável */}
          <section>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
              Responsável
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.6)] mb-1">
                  Nome <span className="text-[rgb(var(--color-danger))]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.resp_nome}
                  onChange={(e) => set("resp_nome", e.target.value)}
                  className="input-ds"
                  placeholder="Nome do responsável"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[rgb(var(--color-ink)/0.6)] mb-1">Parentesco</label>
                  <input
                    type="text"
                    value={form.resp_parentesco}
                    onChange={(e) => set("resp_parentesco", e.target.value)}
                    className="input-ds"
                    placeholder="Pai, Mãe…"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[rgb(var(--color-ink)/0.6)] mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={form.resp_whatsapp}
                    onChange={(e) => set("resp_whatsapp", e.target.value)}
                    className="input-ds"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.6)] mb-1">E-mail</label>
                <input
                  type="email"
                  value={form.resp_email}
                  onChange={(e) => set("resp_email", e.target.value)}
                  className="input-ds"
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
          </section>

          {/* Origem + Status */}
          <section>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
              Informações do lead
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.6)] mb-1">Origem</label>
                <select
                  value={form.origem}
                  onChange={(e) => set("origem", e.target.value)}
                  className="input-ds"
                >
                  <option value="">— Selecione —</option>
                  {ORIGENS_LEAD.map((o) => (
                    <option key={o} value={o}>{ORIGEM_LABEL[o] ?? o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.6)] mb-1">Status</label>
                <select
                  value={form.status_lead}
                  onChange={(e) => set("status_lead", e.target.value)}
                  className="input-ds"
                >
                  {STATUS_LEAD.map((s) => (
                    <option key={s} value={s}>{STATUS_LEAD_LABEL[s] ?? s}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {erro && (
            <p className="text-xs text-[rgb(var(--color-danger))]">{erro}</p>
          )}

          <div className="pt-1 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-1.5 text-sm text-[rgb(var(--color-ink)/0.6)] hover:bg-[rgb(var(--color-muted))]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-[rgb(var(--color-brand))] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {isPending ? "Salvando…" : "Criar card"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
