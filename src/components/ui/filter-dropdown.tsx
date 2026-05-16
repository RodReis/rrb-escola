"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DropdownOption = { value: string; label: string };

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  className,
  emptyLabel = "Todos"
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (next: string) => void;
  className?: string;
  emptyLabel?: string;
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

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button type="button" className="ds-dropdown" onClick={() => setOpen((v) => !v)}>
        <span className="ds-dropdown-label">{label}:</span>
        <span className="ds-dropdown-value">{display}</span>
        <ChevronDown size={14} strokeWidth={2.4} className="text-ink/45" />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1.5 min-w-[180px] overflow-hidden rounded-ui border border-line bg-surface py-1 shadow-soft">
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
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={cn(
                "block w-full px-3 py-1.5 text-left text-sm hover:bg-muted",
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
      ) : null}
    </div>
  );
}
