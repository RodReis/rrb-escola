"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  criarColunaAction,
  editarColunaAction,
  excluirColunaAction,
  reordenarColunasAction,
} from "@/lib/actions/pipeline";
import { COR_COLUNAS } from "@/lib/validation/pipeline";
import { COR_TOKEN_CLASSES } from "@/components/pipeline/types";

type Coluna = {
  id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  etapa_final: boolean;
  prazo_max_dias: number | null;
};

type Props = {
  quadroId: string;
  colunas: Coluna[];
};

const FORM_EMPTY = {
  nome: "",
  cor: "" as string,
  prazo_max_dias: "" as string,
  etapa_final: false,
  ordem: 0,
};

function ColunaItem({
  coluna,
  onEdit,
  onDelete,
}: {
  coluna: Coluna;
  onEdit: (c: Coluna) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: coluna.id,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const corClasses = coluna.cor ? (COR_TOKEN_CLASSES[coluna.cor] ?? "") : "";
  const bgClass = corClasses.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-[rgb(var(--color-muted))]";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-3 py-2.5",
        isDragging && "opacity-50 shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-[rgb(var(--color-ink)/0.3)] hover:text-[rgb(var(--color-ink)/0.6)]"
        aria-label="Arrastar"
      >
        <GripVertical size={14} />
      </button>

      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", bgClass)} />

      <span className="flex-1 text-sm font-medium text-[rgb(var(--color-ink))]">{coluna.nome}</span>

      {coluna.etapa_final && (
        <span className="rounded px-1.5 py-0.5 text-[10px] bg-[rgb(var(--color-success)/0.1)] text-[rgb(var(--color-success))]">
          Final
        </span>
      )}
      {coluna.prazo_max_dias && (
        <span className="text-[10px] text-[rgb(var(--color-ink)/0.4)]">{coluna.prazo_max_dias}d</span>
      )}

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onEdit(coluna)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--color-ink)/0.4)] hover:bg-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-ink))]"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(coluna.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--color-ink)/0.4)] hover:bg-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-danger))]"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export function ColunasConfigClient({ quadroId, colunas: initialColunas }: Props) {
  const [colunas, setColunas] = useState(initialColunas);
  const [painel, setPainel] = useState<"none" | "criar" | string>("none");
  const [form, setForm] = useState(FORM_EMPTY);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function abrirCriar() {
    setForm({ ...FORM_EMPTY, ordem: colunas.length });
    setPainel("criar");
    setErro(null);
  }

  function abrirEditar(c: Coluna) {
    setForm({
      nome: c.nome,
      cor: c.cor ?? "",
      prazo_max_dias: c.prazo_max_dias?.toString() ?? "",
      etapa_final: c.etapa_final,
      ordem: c.ordem,
    });
    setPainel(c.id);
    setErro(null);
  }

  function handleSalvar() {
    setErro(null);
    const input = {
      nome: form.nome,
      cor: (form.cor || null) as (typeof COR_COLUNAS)[number] | null,
      ordem: Number(form.ordem),
      prazo_max_dias: form.prazo_max_dias ? Number(form.prazo_max_dias) : null,
      etapa_final: form.etapa_final,
    };
    startTransition(async () => {
      const r = painel === "criar"
        ? await criarColunaAction(quadroId, input)
        : await editarColunaAction(painel as string, input);

      if (!r.ok) { setErro(r.error); return; }
      window.location.reload();
    });
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const r = await excluirColunaAction(id);
      if (!r.ok) { setErro(r.error); return; }
      setColunas((prev) => prev.filter((c) => c.id !== id));
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = colunas.findIndex((c) => c.id === active.id);
    const newIdx = colunas.findIndex((c) => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = [...colunas];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);

    const ordens = reordered.map((c, i) => ({ id: c.id, ordem: i }));
    setColunas(reordered.map((c, i) => ({ ...c, ordem: i })));

    await reordenarColunasAction(ordens);
  }

  const formAberto = painel !== "none";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={abrirCriar}
          className="flex items-center gap-1.5 rounded-md bg-[rgb(var(--color-brand))] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus size={14} /> Nova coluna
        </button>
      </div>

      {erro && (
        <p className="rounded-md bg-[rgb(var(--color-danger)/0.1)] px-3 py-2 text-xs text-[rgb(var(--color-danger))]">
          {erro}
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={colunas.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {colunas.map((c) => (
              <ColunaItem
                key={c.id}
                coluna={c}
                onEdit={abrirEditar}
                onDelete={handleExcluir}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Painel lateral criação/edição */}
      {formAberto && (
        <div className="rounded-xl border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[rgb(var(--color-ink))]">
              {painel === "criar" ? "Nova coluna" : "Editar coluna"}
            </h3>
            <button
              type="button"
              onClick={() => setPainel("none")}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--color-ink)/0.4)] hover:bg-[rgb(var(--color-muted))]"
            >
              <X size={12} />
            </button>
          </div>

          <div>
            <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Nome *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-3 py-1.5 text-sm text-[rgb(var(--color-ink))]"
              placeholder="Ex: Entrevista Pedagógica"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Cor</label>
            <div className="flex flex-wrap gap-2">
              {COR_COLUNAS.map((cor) => {
                const classes = COR_TOKEN_CLASSES[cor] ?? "";
                const bgCls = classes.split(" ").find((c) => c.startsWith("bg-")) ?? "";
                return (
                  <button
                    key={cor}
                    type="button"
                    title={cor.replace("color-pipeline-", "")}
                    onClick={() => setForm((p) => ({ ...p, cor }))}
                    className={cn(
                      "h-6 w-6 rounded-full transition-all",
                      bgCls,
                      form.cor === cor
                        ? "ring-2 ring-offset-1 ring-[rgb(var(--color-brand))] scale-110"
                        : "opacity-70 hover:opacity-100",
                    )}
                  >
                    {form.cor === cor && <Check size={12} className="mx-auto text-white" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, cor: "" }))}
                className={cn(
                  "h-6 w-6 rounded-full border-2 border-dashed border-[rgb(var(--color-line))] text-[rgb(var(--color-ink)/0.3)] hover:border-[rgb(var(--color-ink)/0.4)]",
                  !form.cor && "border-solid border-[rgb(var(--color-brand))]",
                )}
                title="Sem cor"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Prazo máximo (dias)</label>
            <input
              type="number"
              min={1}
              value={form.prazo_max_dias}
              onChange={(e) => setForm((p) => ({ ...p, prazo_max_dias: e.target.value }))}
              className="w-32 rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-3 py-1.5 text-sm text-[rgb(var(--color-ink))]"
              placeholder="—"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[rgb(var(--color-ink)/0.7)]">
            <input
              type="checkbox"
              checked={form.etapa_final}
              onChange={(e) => setForm((p) => ({ ...p, etapa_final: e.target.checked }))}
              className="h-3.5 w-3.5 rounded"
            />
            Etapa final (convertido / perdido)
          </label>

          {erro && <p className="text-xs text-[rgb(var(--color-danger))]">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSalvar}
              disabled={isPending || !form.nome.trim()}
              className="flex-1 rounded-md bg-[rgb(var(--color-brand))] py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {isPending ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setPainel("none")}
              className="rounded-md border border-[rgb(var(--color-line))] px-3 py-1.5 text-sm text-[rgb(var(--color-ink)/0.6)] hover:bg-[rgb(var(--color-muted))]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
