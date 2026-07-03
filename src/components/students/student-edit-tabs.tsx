"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FileText, FolderOpen, DoorOpen, Network } from "lucide-react";

const TABS = [
  { id: "dados", label: "Dados", icon: FileText },
  { id: "documentos", label: "Documentos", icon: FolderOpen },
  { id: "portaria", label: "Portaria", icon: DoorOpen },
  { id: "relacionados", label: "Relacionados", icon: Network },
] as const;

export function StudentEditTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("tab") ?? "dados";

  return (
    <nav className="flex gap-1 border-b border-line px-6">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={`${pathname}?tab=${t.id}`}
            scroll={false}
            className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
              isActive ? "text-brand" : "text-ink/60 hover:text-ink"
            }`}
          >
            <Icon size={14} />
            {t.label}
            {isActive && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
