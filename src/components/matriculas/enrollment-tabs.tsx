"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";

const TABS = [
  { key: "cadastro",    label: "Cadastro" },
  { key: "financeiro",  label: "Financeiro" },
  { key: "documentos",  label: "Documentos" },
  { key: "frequencia",  label: "Frequência" },
  { key: "auditoria",   label: "Auditoria" },
];

export function EnrollmentTabs() {
  const params   = useSearchParams();
  const router   = useRouter();
  const pathname = usePathname();
  const active   = params.get("tab") ?? "cadastro";

  function go(key: string) {
    const p = new URLSearchParams(params.toString());
    p.set("tab", key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <nav className="flex gap-1 border-b border-line px-6 pt-1 bg-surface">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => go(t.key)}
          className={[
            "px-4 py-3 text-sm font-black transition",
            active === t.key
              ? "border-b-2 border-brand text-brand"
              : "text-ink/50 hover:text-ink",
          ].join(" ")}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
