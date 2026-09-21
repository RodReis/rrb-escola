"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BookOpen, ClipboardList, ShoppingBag, Wallet, type LucideIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { DashTab as Tab } from "./parse-tab";

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "financeiro", label: "Financeiro", icon: Wallet },
  { id: "comercial", label: "Comercial", icon: ShoppingBag },
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
  const router = useRouter();
  // useTransition mostra o spinner na aba clicada enquanto o RSC do
  // dashboard busca os dados da nova aba (navegacao entre paginas, nao
  // Server Action — useAction nao se aplica aqui). Troca <Link> por
  // <button>+router.push: mantem back/forward do browser, mas perde
  // Ctrl/Cmd+click para abrir em nova aba e prefetch automatico.
  const [isPending, startTransition] = useTransition();
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  const allowed = visible ?? (["financeiro", "comercial", "secretaria", "pedagogico"] as const);

  function go(id: Tab, href: string) {
    setPendingTab(id);
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <nav className="flex gap-1 border-b border-line">
      {TABS.filter((t) => allowed.includes(t.id)).map((t) => {
        const Icon = t.icon;
        const isActive = t.id === active;
        const isLoadingThis = isPending && pendingTab === t.id;
        const qs = new URLSearchParams({ aba: t.id });
        if (competencia) qs.set("competencia", competencia);
        const href = `/?${qs.toString()}`;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => go(t.id, href)}
            disabled={isPending}
            aria-busy={isLoadingThis || undefined}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait ${
              isActive
                ? "text-brand"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            {isLoadingThis ? <Spinner size={14} /> : <Icon size={14} />}
            {t.label}
            {isActive && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
