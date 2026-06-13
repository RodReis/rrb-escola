"use client";

import { useState } from "react";
import { maskCurrencyBRL, parseCurrencyBRL, formatCurrencyBRL } from "@/lib/format/masks";

type Props = {
  name: string;
  label: string;
  defaultValue?: number | null;
  placeholder?: string;
  hint?: string;
  className?: string;
};

// Campo monetário pt-BR com máscara. Envia string vazia (não "0") quando zerado,
// para que o schema trate como ausente (optionalPositive rejeita 0).
export function CurrencyField({ name, label, defaultValue, placeholder = "R$ 0,00", hint, className }: Props) {
  const initial = Number(defaultValue ?? 0);
  const [value, setValue] = useState<number>(initial);
  const [display, setDisplay] = useState<string>(initial > 0 ? formatCurrencyBRL(initial) : "");

  return (
    <label className={`flex flex-col gap-1 text-sm font-medium text-ink/80 ${className ?? ""}`}>
      {label}
      <input
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          const masked = maskCurrencyBRL(e.target.value);
          setDisplay(masked);
          setValue(parseCurrencyBRL(masked));
        }}
        onBlur={() => setDisplay(value > 0 ? formatCurrencyBRL(value) : "")}
        className="mt-1 w-full rounded-ui border border-line bg-surface px-3 py-2 text-sm tabular-nums"
      />
      <input type="hidden" name={name} value={value > 0 ? value : ""} />
      {hint ? <span className="text-xs text-ink/45">{hint}</span> : null}
    </label>
  );
}
