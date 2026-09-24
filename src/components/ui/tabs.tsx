"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TabItem = {
  value: string;
  label: string;
  content: ReactNode;
};

type Props = {
  defaultValue: string;
  items: TabItem[];
  className?: string;
};

/**
 * Abas simples, sem lib externa (YAGNI) — usado no formulario de Empresa
 * para separar Endereco / Assinaturas / Outras informacoes sem exigir scroll
 * por um form gigante.
 */
export function Tabs({ defaultValue, items, className }: Props) {
  const [active, setActive] = useState(defaultValue);
  const activeItem = items.find((item) => item.value === active) ?? items[0];

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-2 border-b border-line">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={item.value === active}
            onClick={() => setActive(item.value)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              item.value === active
                ? "border-brand text-ink"
                : "border-transparent text-ink/55 hover:text-ink/80"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{activeItem?.content}</div>
    </div>
  );
}
