"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITUACAO_ESCOLAR } from "@/lib/validation/pipeline";
import type { getCardDetalhe } from "@/lib/actions/pipeline";

type Lead = NonNullable<Awaited<ReturnType<typeof getCardDetalhe>>["data"]>["lead"];

type Props = {
  cardId: string;
  lead: Lead;
  onSave: (data: {
    escola_anterior?: string | null;
    motivo_transferencia?: string | null;
    situacao_escolar?: string | null;
    observacoes_pedagogicas?: string | null;
  }) => Promise<void>;
};

const SITUACAO_LABEL: Record<string, string> = {
  regular: "Regular",
  transferencia: "Transferência",
  abandono: "Abandono",
  conclusao: "Conclusão",
};

export function DadosEducacionaisSection({ cardId: _cardId, lead, onSave }: Props) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState({
    escola_anterior: (lead as Record<string, string | null>)?.escola_anterior ?? "",
    motivo_transferencia: (lead as Record<string, string | null>)?.motivo_transferencia ?? "",
    situacao_escolar: (lead as Record<string, string | null>)?.situacao_escolar ?? "",
    observacoes_pedagogicas: (lead as Record<string, string | null>)?.observacoes_pedagogicas ?? "",
  });

  const temDados = !!(
    form.escola_anterior ||
    form.motivo_transferencia ||
    form.situacao_escolar ||
    form.observacoes_pedagogicas
  );

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      try {
        await onSave({
          escola_anterior: form.escola_anterior || null,
          motivo_transferencia: form.motivo_transferencia || null,
          situacao_escolar: form.situacao_escolar || null,
          observacoes_pedagogicas: form.observacoes_pedagogicas || null,
        });
        setEditando(false);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between mb-2"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
          Dados Educacionais
          {temDados && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-brand))] align-middle" />}
        </h4>
        {aberto
          ? <ChevronDown size={12} className="text-[rgb(var(--color-ink)/0.4)]" />
          : <ChevronRight size={12} className="text-[rgb(var(--color-ink)/0.4)]" />}
      </button>

      {aberto && (
        <div>
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => { setEditando((v) => !v); setErro(null); }}
              className="text-xs text-[rgb(var(--color-brand))] hover:underline"
            >
              {editando ? "Cancelar" : "Editar"}
            </button>
          </div>

          {!editando && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {form.escola_anterior && (
                <>
                  <span className="text-xs text-[rgb(var(--color-ink)/0.55)]">Escola anterior</span>
                  <span className="text-xs text-[rgb(var(--color-ink))]">{form.escola_anterior}</span>
                </>
              )}
              {form.situacao_escolar && (
                <>
                  <span className="text-xs text-[rgb(var(--color-ink)/0.55)]">Situação</span>
                  <span className="text-xs text-[rgb(var(--color-ink))]">
                    {SITUACAO_LABEL[form.situacao_escolar] ?? form.situacao_escolar}
                  </span>
                </>
              )}
              {form.motivo_transferencia && (
                <>
                  <span className="text-xs text-[rgb(var(--color-ink)/0.55)]">Motivo</span>
                  <span className="text-xs text-[rgb(var(--color-ink))]">{form.motivo_transferencia}</span>
                </>
              )}
              {form.observacoes_pedagogicas && (
                <>
                  <span className="col-span-2 text-xs text-[rgb(var(--color-ink)/0.55)]">Observações</span>
                  <span className="col-span-2 text-xs text-[rgb(var(--color-ink))]">{form.observacoes_pedagogicas}</span>
                </>
              )}
              {!temDados && (
                <p className="col-span-2 text-xs text-[rgb(var(--color-ink)/0.4)]">Nenhum dado educacional preenchido.</p>
              )}
            </div>
          )}

          {editando && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Escola anterior</label>
                <input
                  type="text"
                  value={form.escola_anterior}
                  onChange={(e) => setForm((p) => ({ ...p, escola_anterior: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]"
                  placeholder="Nome da escola anterior"
                />
              </div>

              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Situação escolar</label>
                <select
                  value={form.situacao_escolar}
                  onChange={(e) => setForm((p) => ({ ...p, situacao_escolar: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]"
                >
                  <option value="">— Selecione —</option>
                  {SITUACAO_ESCOLAR.map((s) => (
                    <option key={s} value={s}>{SITUACAO_LABEL[s] ?? s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Motivo de transferência</label>
                <input
                  type="text"
                  value={form.motivo_transferencia}
                  onChange={(e) => setForm((p) => ({ ...p, motivo_transferencia: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]"
                  placeholder="Motivo da transferência (se aplicável)"
                />
              </div>

              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Observações pedagógicas</label>
                <textarea
                  value={form.observacoes_pedagogicas}
                  onChange={(e) => setForm((p) => ({ ...p, observacoes_pedagogicas: e.target.value }))}
                  rows={3}
                  className={cn(
                    "w-full rounded-md border border-[rgb(var(--color-line))]",
                    "bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]",
                    "resize-none",
                  )}
                  placeholder="Necessidades especiais, ritmo de aprendizado, etc."
                />
              </div>

              {erro && <p className="text-xs text-[rgb(var(--color-danger))]">{erro}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={isPending}
                  className="rounded-md bg-[rgb(var(--color-brand))] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
