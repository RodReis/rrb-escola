"use client";

import { cn } from "@/lib/utils";

export type FilterChip = {
  value: string;
  label: string;
  count?: number;
};

export function FilterChips({
  items,
  value,
  onChange,
  className
}: {
  items: FilterChip[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            data-active={active}
            className="ds-chip"
            onClick={() => onChange(item.value)}
          >
            <span>{item.label}</span>
            {item.count != null ? <span className="ds-chip-count">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
