import Link from "next/link";
import { BookOpen, ClipboardList, Wallet, type LucideIcon } from "lucide-react";

type Tab = "financeiro" | "secretaria" | "pedagogico";

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "financeiro", label: "Financeiro", icon: Wallet },
  { id: "secretaria", label: "Secretaria", icon: ClipboardList },
  { id: "pedagogico", label: "Pedagógico", icon: BookOpen },
];

export function DashboardTabs({
  active,
  competencia,
  visible,
}: {
  active: Tab;
  competencia?: string;
  visible?: ReadonlyArray<Tab>;
}) {
  const allowed = visible ?? (["financeiro", "secretaria", "pedagogico"] as const);
  return (
    <nav className="flex gap-1 border-b border-line">
      {TABS.filter((t) => allowed.includes(t.id)).map((t) => {
        const Icon = t.icon;
        const isActive = t.id === active;
        const qs = new URLSearchParams({ aba: t.id });
        if (competencia) qs.set("competencia", competencia);
        return (
          <Link
            key={t.id}
            href={`/?${qs.toString()}`}
            scroll={false}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? "text-brand"
                : "text-ink/55 hover:text-ink"
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

export function parseTab(value: string | undefined): Tab {
  // Backward compat: aba=alunos -> secretaria
  if (value === "alunos" || value === "secretaria") return "secretaria";
  if (value === "pedagogico") return "pedagogico";
  return "financeiro";
}
