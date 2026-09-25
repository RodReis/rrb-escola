"use client";

import { Minus, Plus } from "lucide-react";

type Props = { value: number; onChange: (v: number) => void; min: number; max: number; step: number; ariaLabel: string; decimais?: number };

export function Stepper({ value, onChange, min, max, step, ariaLabel, decimais = 0 }: Props) {
  const ajustar = (v: number) => {
    const n = Number.isNaN(v) ? min : Math.round(v / step) * step;
    onChange(Number(Math.min(max, Math.max(min, n)).toFixed(decimais)));
  };
  return (
    <div className="flex h-10 items-center rounded-ui border border-line bg-surface">
      <button type="button" aria-label={`Diminuir ${ariaLabel}`} className="px-3 text-ink/70 hover:text-ink disabled:opacity-40" disabled={value <= min} onClick={() => ajustar(value - step)}>
        <Minus size={14} />
      </button>
      <input
        aria-label={ariaLabel}
        type="number"
        inputMode="decimal"
        className="w-full min-w-0 border-0 bg-transparent text-right text-sm text-ink focus:outline-none"
        value={value.toLocaleString("en-US", { minimumFractionDigits: decimais, maximumFractionDigits: decimais })}
        min={min}
        max={max}
        step={step}
        onChange={(e) => ajustar(Number(e.target.value))}
      />
      <button type="button" aria-label={`Aumentar ${ariaLabel}`} className="px-3 text-ink/70 hover:text-ink disabled:opacity-40" disabled={value >= max} onClick={() => ajustar(value + step)}>
        <Plus size={14} />
      </button>
    </div>
  );
}
