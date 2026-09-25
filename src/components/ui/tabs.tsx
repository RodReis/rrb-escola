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
      {/* Painéis ficam sempre montados no DOM (só escondidos com `hidden`) para
          que os inputs das abas inativas continuem existindo — se fossem
          desmontados condicionalmente, o FormData do submit perderia os
          campos de qualquer aba que não estivesse visível no momento. */}
      {items.map((item) => (
        <div key={item.value} role="tabpanel" hidden={item.value !== active} className="pt-4">
          {item.content}
        </div>
      ))}
    </div>
  );
}
