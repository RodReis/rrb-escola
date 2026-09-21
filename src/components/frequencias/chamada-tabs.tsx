"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { CalendarCheck, ClipboardEdit } from "lucide-react";

export function ChamadaTabs({ tab }: { tab: "chamada" | "notas" }) {
  const sp = useSearchParams();
  const pathname = usePathname();

  function hrefFor(t: "chamada" | "notas") {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("tab", t);
    return `${pathname}?${params.toString()}`;
  }

  const tabs: Array<{ id: "chamada" | "notas"; label: string; Icon: typeof CalendarCheck }> = [
    { id: "chamada", label: "Chamada", Icon: CalendarCheck },
    { id: "notas", label: "Notas", Icon: ClipboardEdit },
  ];

  return (
    <nav className="flex gap-1 border-b border-line">
      {tabs.map((t) => {
        const ativo = t.id === tab;
        return (
          <Link
            key={t.id}
            href={hrefFor(t.id)}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition ${
              ativo ? "text-brand" : "text-ink/60 hover:text-ink"
            }`}
          >
            <t.Icon size={14} />
            {t.label}
            {ativo && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
