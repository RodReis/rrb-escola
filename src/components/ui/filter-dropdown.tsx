"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DropdownOption = { value: string; label: string; group?: string };

/** Fecha ao clicar fora, e desloca o painel em X só o necessário pra caber
 * na janela — compartilhado entre FilterDropdown (seleção única) e
 * MultiFilterDropdown (seleção múltipla). */
function usePainelFlutuante(open: boolean, setOpen: (v: boolean) => void) {
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
  }, [open, setOpen]);

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
    setDesvioX(-Math.min(excedeDireita, Math.max(0, esquerda - MARGEM)));
  }, [open]);

  return { ref, panelRef, desvioX };
}

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
  const { ref, panelRef, desvioX } = usePainelFlutuante(open, setOpen);

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

/** Como FilterDropdown, mas seleção múltipla por checkbox — o painel não
 * fecha ao marcar um item, e o botão mostra "N selecionadas" em vez do
 * valor único. Usado onde o filtro é genuinamente multi (turmas,
 * disciplinas de um professor), no lugar da antiga grade de botões soltos
 * (sem largura/alinhamento consistentes). */
export function MultiFilterDropdown({
  label,
  value,
  options,
  onChange,
  className,
  emptyLabel = "Todas",
  disabled = false
}: {
  label: string;
  value: string[];
  options: DropdownOption[];
  onChange: (next: string[]) => void;
  className?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { ref, panelRef, desvioX } = usePainelFlutuante(open, setOpen);

  const display: ReactNode = value.length === 0 ? emptyLabel : value.length === 1
    ? (options.find((o) => o.value === value[0])?.label ?? emptyLabel)
    : `${value.length} selecionadas`;

  const groups: { name: string | null; items: DropdownOption[] }[] = [];
  for (const option of options) {
    const name = option.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(option);
    else groups.push({ name, items: [option] });
  }

  const alternar = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

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
          className="absolute left-0 z-30 mt-1.5 max-h-[320px] min-w-[220px] max-w-[320px] overflow-y-auto overflow-x-hidden rounded-ui border border-line bg-surface py-1 shadow-soft"
          style={desvioX ? { transform: `translateX(${desvioX}px)` } : undefined}
        >
          {value.length > 0 ? (
            <button type="button" className="block w-full px-3 py-1.5 text-left text-sm font-medium text-brand hover:bg-muted" onClick={() => onChange([])}>
              Limpar seleção
            </button>
          ) : null}
          {options.length === 0 ? <p className="px-3 py-2 text-sm text-ink/50">Nenhuma opção disponível.</p> : null}
          {groups.map((g) => (
            <div key={g.name ?? "__sem_grupo"}>
              {g.name ? (
                <p className="mt-1 px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink/45">
                  {g.name}
                </p>
              ) : null}
              {g.items.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted">
                  <input type="checkbox" className="h-4 w-4 shrink-0 accent-brand" checked={value.includes(o.value)} onChange={() => alternar(o.value)} />
                  <span className="truncate" title={o.label}>{o.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
