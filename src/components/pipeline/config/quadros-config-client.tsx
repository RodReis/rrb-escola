"use client";

import { useState, useTransition } from "react";
import { Plus, Archive, Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  criarQuadroAction,
  editarQuadroAction,
  arquivarQuadroAction,
} from "@/lib/actions/pipeline";
import { TIPOS_QUADRO } from "@/lib/validation/pipeline";

type Quadro = {
  id: string;
  nome: string;
  tipo: string;
  ordem: number;
  ativo: boolean;
  descricao: string | null;
};

type Props = { quadros: Quadro[] };

const TIPO_LABEL: Record<string, string> = {
  captacao: "Captação",
  rematricula: "Rematrícula",
  reserva: "Reserva",
};

const FORM_EMPTY = { nome: "", descricao: "", tipo: "captacao" as string, ordem: 0, ativo: true };

export function QuadrosConfigClient({ quadros: initialQuadros }: Props) {
  const [quadros, setQuadros] = useState(initialQuadros);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_EMPTY);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrirCriar() {
    setForm(FORM_EMPTY);
    setEditandoId(null);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(q: Quadro) {
    setForm({ nome: q.nome, descricao: q.descricao ?? "", tipo: q.tipo, ordem: q.ordem, ativo: q.ativo });
    setEditandoId(q.id);
    setErro(null);
    setModalAberto(true);
  }

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      const input = { ...form, tipo: form.tipo as (typeof TIPOS_QUADRO)[number] };
      const r = editandoId
        ? await editarQuadroAction(editandoId, input)
        : await criarQuadroAction(input);
      if (!r.ok) { setErro(r.error); return; }

      // Atualiza lista localmente (simplificado — ideal: revalidatePath via Server Action)
      window.location.reload();
    });
  }

  function handleArquivar(id: string) {
    startTransition(async () => {
      await arquivarQuadroAction(id);
      setQuadros((prev) => prev.map((q) => q.id === id ? { ...q, ativo: false } : q));
    });
  }

  function handleRestaurar(id: string) {
    startTransition(async () => {
      await editarQuadroAction(id, {
        nome: quadros.find((q) => q.id === id)?.nome ?? "",
        tipo: (quadros.find((q) => q.id === id)?.tipo ?? "captacao") as (typeof TIPOS_QUADRO)[number],
        ordem: quadros.find((q) => q.id === id)?.ordem ?? 0,
        ativo: true,
      });
      setQuadros((prev) => prev.map((q) => q.id === id ? { ...q, ativo: true } : q));
    });
  }

  const ativos = quadros.filter((q) => q.ativo);
  const arquivados = quadros.filter((q) => !q.ativo);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={abrirCriar}
          className="flex items-center gap-1.5 rounded-md bg-[rgb(var(--color-brand))] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus size={14} /> Novo quadro
        </button>
      </div>

      <div className="space-y-2">
        {ativos.map((q) => (
          <div
            key={q.id}
            className="flex items-center justify-between rounded-lg border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-4 py-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-[rgb(var(--color-ink))]">{q.nome}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] bg-[rgb(var(--color-muted))] text-[rgb(var(--color-ink)/0.6)]">
                  {TIPO_LABEL[q.tipo] ?? q.tipo}
                </span>
              </div>
              {q.descricao && (
                <p className="mt-0.5 text-xs text-[rgb(var(--color-ink)/0.5)]">{q.descricao}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <a
                href={`/pipeline/config/${q.id}`}
                className="rounded-md px-2 py-1 text-xs text-[rgb(var(--color-brand))] hover:bg-[rgb(var(--color-muted))]"
              >
                Colunas
              </a>
              <button
                type="button"
                onClick={() => abrirEditar(q)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--color-ink)/0.4)] hover:bg-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-ink))]"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleArquivar(q.id)}
                disabled={isPending}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--color-ink)/0.4)] hover:bg-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-danger))]"
                title="Arquivar"
              >
                <Archive size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {arquivados.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.4)]">
            Arquivados
          </h3>
          <div className="space-y-2">
            {arquivados.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between rounded-lg border border-[rgb(var(--color-line))] bg-[rgb(var(--color-paper))] px-4 py-3 opacity-60"
              >
                <span className="text-sm text-[rgb(var(--color-ink))]">{q.nome}</span>
                <button
                  type="button"
                  onClick={() => handleRestaurar(q.id)}
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs text-[rgb(var(--color-brand))] hover:underline"
                >
                  <RotateCcw size={11} /> Restaurar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]" onClick={() => setModalAberto(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] p-6 shadow-2xl">
            <h2 className="mb-4 text-base font-semibold text-[rgb(var(--color-ink))]">
              {editandoId ? "Editar quadro" : "Novo quadro"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-3 py-1.5 text-sm text-[rgb(var(--color-ink))]"
                  placeholder="Ex: Captação 2025"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-3 py-1.5 text-sm text-[rgb(var(--color-ink))]"
                >
                  {TIPOS_QUADRO.map((t) => (
                    <option key={t} value={t}>{TIPO_LABEL[t] ?? t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Descrição</label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-3 py-1.5 text-sm text-[rgb(var(--color-ink))]"
                  placeholder="Opcional"
                />
              </div>
              {erro && <p className="text-xs text-[rgb(var(--color-danger))]">{erro}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={isPending || !form.nome.trim()}
                  className={cn(
                    "flex-1 rounded-md bg-[rgb(var(--color-brand))] py-1.5 text-sm font-semibold text-white",
                    "hover:opacity-90 disabled:opacity-40",
                  )}
                >
                  {isPending ? "Salvando…" : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-md border border-[rgb(var(--color-line))] px-3 py-1.5 text-sm text-[rgb(var(--color-ink)/0.6)] hover:bg-[rgb(var(--color-muted))]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
