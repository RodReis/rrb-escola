"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

export type DropdownOption = { value: string; label: string };

type Props = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  width?: number;
};

/**
 * Dropdown de filtro customizado — substitui o <select> nativo para evitar
 * o corte do texto fechado (Chrome/Windows reserva espaço interno da seta).
 * Lista renderizada em posição fixa para não ser clipada por overflow.
 */
export function FilterDropdown({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel,
  width = 180,
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;
  const isPlaceholder = !selected;

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    function onScroll() { place(); }
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, place]);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ width }}
        className={`group flex h-8 items-center justify-between gap-1.5 rounded-md border px-2.5 text-sm transition-colors ${
          open
            ? "border-[rgb(var(--color-brand)/0.5)] ring-1 ring-[rgb(var(--color-brand)/0.3)]"
            : "border-[rgb(var(--color-line))]"
        } bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-muted))]`}
      >
        <span
          className={`truncate ${isPlaceholder ? "text-[rgb(var(--color-ink)/0.55)]" : "text-[rgb(var(--color-ink))]"}`}
        >
          {label}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[rgb(var(--color-ink)/0.4)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && coords && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            minWidth: coords.width,
            maxWidth: 280,
            zIndex: 60,
          }}
          className="max-h-72 overflow-y-auto rounded-lg border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] p-1 shadow-lg"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(opt.value)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                  active
                    ? "bg-[rgb(var(--color-brand)/0.1)] text-[rgb(var(--color-brand))] font-medium"
                    : "text-[rgb(var(--color-ink))] hover:bg-[rgb(var(--color-muted))]"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {active && <Check size={14} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
