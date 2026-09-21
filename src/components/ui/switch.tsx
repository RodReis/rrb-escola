"use client";

import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
};

/**
 * Toggle on/off com o rótulo ao lado, como as demais linhas de formulário do
 * app — evita o checkbox nativo pequeno flutuando longe do texto quando o
 * label quebra em duas linhas.
 */
export function Switch({ checked, onChange, label, description, disabled, className }: Props) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 text-sm font-medium text-ink/80",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-brand bg-brand" : "border-line bg-muted"
        )}
      >
        <span
          className={cn(
            "inline-block size-3.5 translate-x-0.5 rounded-full bg-paper shadow-pill transition-transform",
            checked && "translate-x-[18px]"
          )}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {description ? <span className="text-xs font-normal text-ink/55">{description}</span> : null}
      </span>
    </label>
  );
}
