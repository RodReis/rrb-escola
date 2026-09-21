"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface Props {
  anos: number[];
}

function AnoLetivoPickerInner({ anos }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = Number(searchParams.get("ano")) || new Date().getFullYear();

  function handleChange(ano: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("ano", String(ano));
    sp.set("competencia", `${ano}-01`);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="ds-dropdown relative" style={{ gap: "0.4rem" }}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <select
        value={current}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="ds-dropdown-value appearance-none bg-transparent focus:outline-none cursor-pointer"
      >
        {anos.map((ano) => (
          <option key={ano} value={ano} style={{ background: "var(--surface)", color: "var(--text)" }}>
            {ano}
          </option>
        ))}
      </select>
      <ChevronDown size={11} className="pointer-events-none shrink-0" style={{ color: "var(--text-muted)" }} />
    </div>
  );
}

export function AnoLetivoPicker({ anos }: Props) {
  return (
    <Suspense fallback={
      <div className="ds-dropdown">
        <span className="ds-dropdown-value">{new Date().getFullYear()}</span>
      </div>
    }>
      <AnoLetivoPickerInner anos={anos} />
    </Suspense>
  );
}
