"use client";

import { cn } from "@/lib/utils";

type Props = { value: boolean; onChange: (v: boolean) => void; ariaLabel: string; labels?: [string, string] };

export function Segmentado({ value, onChange, ariaLabel, labels = ["Sim", "Não"] }: Props) {
  const opcoes: Array<[boolean, string]> = [[true, labels[0]], [false, labels[1]]];
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid h-10 grid-cols-2 overflow-hidden rounded-ui border border-line">
      {opcoes.map(([v, label]) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "text-sm transition-colors",
            value === v ? "bg-brand/10 font-semibold text-brand ring-1 ring-inset ring-brand" : "bg-surface text-ink/70 hover:bg-muted"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
