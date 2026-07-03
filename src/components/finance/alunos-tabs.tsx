import Link from "next/link";
import { AlertTriangle, BadgePercent, type LucideIcon } from "lucide-react";

export type AlunosTab = "sem-valor" | "com-desconto";

const TABS: Array<{ id: AlunosTab; label: string; icon: LucideIcon }> = [
  { id: "sem-valor", label: "Sem valor", icon: AlertTriangle },
  { id: "com-desconto", label: "Com desconto", icon: BadgePercent },
];

export function AlunosTabs({ active }: { active: AlunosTab }) {
  return (
    <nav className="flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={`/financeiro/alunos-sem-valor?aba=${t.id}`}
            scroll={false}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
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

export function parseAlunosTab(value: string | undefined): AlunosTab {
  return value === "com-desconto" ? "com-desconto" : "sem-valor";
}
