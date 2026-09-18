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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
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
        <div className="absolute right-0 z-30 mt-1.5 max-h-[320px] min-w-[180px] max-w-[320px] overflow-y-auto overflow-x-hidden rounded-ui border border-line bg-surface py-1 shadow-soft">
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
