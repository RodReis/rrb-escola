"use client";

import { useState, useEffect } from "react";
import { maskCurrencyBRL, parseCurrencyBRL, formatCurrencyBRL } from "@/lib/format/masks";

type Props = {
  name: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
};

export function CurrencyInput({ name, value, onChange, disabled, required, placeholder = "R$ 0,00", className, id }: Props) {
  const [display, setDisplay] = useState(formatCurrencyBRL(value));

  useEffect(() => {
    // Sincroniza quando value muda externamente (e.g. reset)
    const parsed = parseCurrencyBRL(display);
    if (Math.abs(parsed - (value ?? 0)) > 0.005) {
      setDisplay(formatCurrencyBRL(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const masked = maskCurrencyBRL(e.target.value);
          setDisplay(masked);
          onChange(parseCurrencyBRL(masked));
        }}
        onBlur={() => setDisplay(formatCurrencyBRL(value))}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className={className ?? "mt-1 w-full rounded-ui border border-line bg-surface px-3 py-2 text-sm tabular-nums"}
      />
      <input type="hidden" name={name} value={value} />
    </>
  );
}
