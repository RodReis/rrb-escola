"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DropdownOption = { value: string; label: string; group?: string };

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  className,
  emptyLabel = "Todos",
  disabled = false,
  hideEmpty = false
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (next: string) => void;
  className?: string;
  emptyLabel?: string;
  disabled?: boolean;
  hideEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [desvioX, setDesvioX] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // O painel abre alinhado à esquerda do botão. Depois de montar, mede e
  // desloca em X só o necessário para caber na janela — cobre tanto o filtro
  // colado na borda direita quanto o painel mais largo que o espaço restante.
  // Antes era `right-0` fixo, que jogava o menu para fora da tela nos filtros
  // mais à esquerda (o caso do "Turma" na segunda linha).
  useEffect(() => {
    if (!open) {
      setDesvioX(0);
      return;
    }
    const botao = ref.current;
    const painel = panelRef.current;
    if (!botao || !painel) return;

    const MARGEM = 8;
    const esquerda = botao.getBoundingClientRect().left;
    const largura = painel.offsetWidth;
    const excedeDireita = esquerda + largura - (window.innerWidth - MARGEM);
    if (excedeDireita <= 0) {
      setDesvioX(0);
      return;
    }
    // Puxa para a esquerda, sem deixar a borda esquerda sair da tela.
    setDesvioX(-Math.min(excedeDireita, Math.max(0, esquerda - MARGEM)));
  }, [open]);

  const current = options.find((o) => o.value === value);
  const display: ReactNode = current?.label ?? emptyLabel;

  // Agrupa preservando a ordem de chegada das opcoes.
  const groups: { name: string | null; items: DropdownOption[] }[] = [];
  for (const option of options) {
    const name = option.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(option);
    else groups.push({ name, items: [option] });
  }

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        className="ds-dropdown disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ds-dropdown-label">{label}:</span>
        <span className="ds-dropdown-value">{display}</span>
        <ChevronDown size={14} strokeWidth={2.4} className="text-ink/45" />
      </button>
      {open && !disabled ? (
        <div
          ref={panelRef}
          className="absolute left-0 z-30 mt-1.5 max-h-[320px] min-w-[180px] max-w-[320px] overflow-y-auto overflow-x-hidden rounded-ui border border-line bg-surface py-1 shadow-soft"
          style={desvioX ? { transform: `translateX(${desvioX}px)` } : undefined}
        >
          {hideEmpty ? null : (
            <button
              type="button"
              className={cn(
                "block w-full px-3 py-1.5 text-left text-sm hover:bg-muted",
                !value && "font-semibold text-brand"
              )}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {emptyLabel}
            </button>
          )}
          {groups.map((g) => (
            <div key={g.name ?? "__sem_grupo"}>
              {g.name ? (
                <p className="mt-1 px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink/45">
                  {g.name}
                </p>
              ) : null}
              {g.items.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={cn(
                    "block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted",
                    o.value === value && "font-semibold text-brand"
                  )}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
