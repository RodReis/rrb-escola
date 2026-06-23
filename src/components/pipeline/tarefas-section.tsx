"use client";

import { useState } from "react";
import { CheckSquare, Plus, CheckCircle2, XCircle, Circle } from "lucide-react";
import type { Tarefa } from "@/lib/actions/pipeline";
import { criarTarefaAction, concluirTarefaAction, cancelarTarefaAction } from "@/lib/actions/pipeline";

type Perfil = { id: string; nome: string };

type Props = {
  cardId: string;
  tarefas: Tarefa[];
  perfis: Perfil[];
  onUpdated: () => void;
};

function isVencida(t: Tarefa) {
  return t.status === "aberta" && !!t.due_at && new Date(t.due_at) < new Date();
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function TarefasSection({ cardId, tarefas, perfis, onUpdated }: Props) {
  const [novaAberta, setNovaAberta] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const abertas = tarefas.filter((t) => t.status === "aberta");
  const concluidas = tarefas.filter((t) => t.status === "concluida");

  async function handleCriar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    setErro(null);
    const result = await criarTarefaAction(cardId, {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      assigned_to: assignedTo || null,
    });
    setSalvando(false);
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    setTitulo("");
    setDescricao("");
    setDueAt("");
    setAssignedTo("");
    setNovaAberta(false);
    onUpdated();
  }

  async function handleConcluir(id: string) {
    await concluirTarefaAction(id);
    onUpdated();
  }

  async function handleCancelar(id: string) {
    await cancelarTarefaAction(id);
    onUpdated();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={15} style={{ color: "rgb(var(--color-brand))" }} />
          <span className="text-sm font-medium" style={{ color: "rgb(var(--color-ink))" }}>
            Tarefas
          </span>
          {abertas.length > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: "rgb(var(--color-brand)/0.12)", color: "rgb(var(--color-brand))" }}
            >
              {abertas.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setNovaAberta((v) => !v)}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
          style={{ background: "rgb(var(--color-brand)/0.08)", color: "rgb(var(--color-brand))" }}
        >
          <Plus size={12} />
          Nova
        </button>
      </div>

      {novaAberta && (
        <div
          className="space-y-2 rounded-md border p-3"
          style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-muted)/0.4)" }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Título da tarefa *"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full rounded border px-2 py-1.5 text-sm"
            style={{
              borderColor: "rgb(var(--color-line))",
              background: "rgb(var(--color-surface))",
              color: "rgb(var(--color-ink))",
            }}
          />
          <textarea
            placeholder="Descrição (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="w-full rounded border px-2 py-1.5 text-sm resize-none"
            style={{
              borderColor: "rgb(var(--color-line))",
              background: "rgb(var(--color-surface))",
              color: "rgb(var(--color-ink))",
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs mb-0.5 block" style={{ color: "rgb(var(--color-ink)/0.55)" }}>
                Vencimento
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
                style={{
                  borderColor: "rgb(var(--color-line))",
                  background: "rgb(var(--color-surface))",
                  color: "rgb(var(--color-ink))",
                }}
              />
            </div>
            <div>
              <label className="text-xs mb-0.5 block" style={{ color: "rgb(var(--color-ink)/0.55)" }}>
                Responsável
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
                style={{
                  borderColor: "rgb(var(--color-line))",
                  background: "rgb(var(--color-surface))",
                  color: "rgb(var(--color-ink))",
                }}
              >
                <option value="">Nenhum</option>
                {perfis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {erro && (
            <p className="text-xs" style={{ color: "rgb(var(--color-danger))" }}>
              {erro}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleCriar}
              disabled={salvando || !titulo.trim()}
              className="rounded px-3 py-1 text-xs font-medium disabled:opacity-50"
              style={{ background: "rgb(var(--color-brand))", color: "#fff" }}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={() => { setNovaAberta(false); setErro(null); }}
              className="rounded px-3 py-1 text-xs"
              style={{ color: "rgb(var(--color-ink)/0.55)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {abertas.length > 0 && (
        <ul className="space-y-1.5">
          {abertas.map((t) => (
            <TarefaItem
              key={t.id}
              tarefa={t}
              vencida={isVencida(t)}
              onConcluir={() => handleConcluir(t.id)}
              onCancelar={() => handleCancelar(t.id)}
            />
          ))}
        </ul>
      )}

      {concluidas.length > 0 && (
        <div>
          <p className="text-xs mb-1" style={{ color: "rgb(var(--color-ink)/0.55)" }}>
            Concluídas
          </p>
          <ul className="space-y-1">
            {concluidas.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs"
                style={{ color: "rgb(var(--color-ink)/0.55)", background: "rgb(var(--color-muted)/0.4)" }}
              >
                <CheckCircle2 size={12} style={{ color: "rgb(var(--color-success))" }} />
                <span className="line-through">{t.titulo}</span>
                {t.completed_at && (
                  <span className="ml-auto">{formatDate(t.completed_at)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tarefas.length === 0 && !novaAberta && (
        <p className="text-xs" style={{ color: "rgb(var(--color-ink)/0.55)" }}>
          Nenhuma tarefa. Clique em "+ Nova" para adicionar.
        </p>
      )}
    </div>
  );
}

function TarefaItem({
  tarefa,
  vencida,
  onConcluir,
  onCancelar,
}: {
  tarefa: Tarefa;
  vencida: boolean;
  onConcluir: () => void;
  onCancelar: () => void;
}) {
  return (
    <li
      className="flex items-center gap-2 rounded-md px-2 py-1.5"
      style={{
        background: vencida ? "rgb(var(--color-danger)/0.08)" : "rgb(var(--color-muted)/0.4)",
        borderLeft: vencida ? "3px solid rgb(var(--color-danger)/0.5)" : "3px solid transparent",
      }}
    >
      <Circle size={12} style={{ color: "rgb(var(--color-ink)/0.55)", flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {vencida && (
            <span
              className="text-[10px] font-bold px-1 rounded"
              style={{ background: "rgb(var(--color-danger)/0.15)", color: "rgb(var(--color-danger))" }}
            >
              VENCIDA
            </span>
          )}
          <span className="text-xs truncate" style={{ color: "rgb(var(--color-ink))" }}>
            {tarefa.titulo}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {tarefa.due_at && (
            <span className="text-[10px]" style={{ color: vencida ? "rgb(var(--color-danger))" : "rgb(var(--color-ink)/0.55)" }}>
              {formatDate(tarefa.due_at)}
            </span>
          )}
          {tarefa.perfil_assigned && (
            <span className="text-[10px]" style={{ color: "rgb(var(--color-ink)/0.55)" }}>
              {tarefa.perfil_assigned.nome}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onConcluir}
          title="Concluir"
          className="rounded p-0.5 hover:opacity-80"
          style={{ color: "rgb(var(--color-success))" }}
        >
          <CheckCircle2 size={14} />
        </button>
        <button
          onClick={onCancelar}
          title="Cancelar"
          className="rounded p-0.5 hover:opacity-80"
          style={{ color: "rgb(var(--color-ink)/0.55)" }}
        >
          <XCircle size={14} />
        </button>
      </div>
    </li>
  );
}
