import Link from "next/link";
import { ListChecks, Sparkles, ArrowLeftRight, type LucideIcon } from "lucide-react";

export type DebitosTab = "a-classificar" | "sugestoes" | "transferencias";

const TABS: Array<{ id: DebitosTab; label: string; icon: LucideIcon }> = [
  { id: "a-classificar", label: "A classificar", icon: ListChecks },
  { id: "sugestoes", label: "Sugestões", icon: Sparkles },
  { id: "transferencias", label: "Transferências internas", icon: ArrowLeftRight },
];

export function DebitosTabs({ active, counts }: { active: DebitosTab; counts: Record<DebitosTab, number> }) {
  return (
    <nav className="flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={`/financeiro/tesouraria/conciliacao?debitos=${t.id}`}
            scroll={false}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              isActive ? "text-brand" : "text-ink/60 hover:text-ink"
            }`}
          >
            <Icon size={14} />
            {t.label}
            <span className="text-xs font-normal text-ink/50">({counts[t.id]})</span>
            {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function parseDebitosTab(value: string | undefined): DebitosTab {
  if (value === "sugestoes" || value === "transferencias") return value;
  return "a-classificar";
}
