import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function Acordeao({ titulo, children, defaultOpen = false }: { titulo: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-ui border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
        {titulo}
        <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
