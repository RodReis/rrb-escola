"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface Props {
  anos: number[];
}

function AnoLetivoPickerInner({ anos }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = Number(searchParams.get("ano")) || new Date().getFullYear();

  function handleChange(ano: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("ano", String(ano));
    sp.set("competencia", `${ano}-01`);
    router.push(`/?${sp.toString()}`);
  }

  return (
    <div className="relative inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[7px] text-[11.5px] font-medium text-white/70 bg-white/10 border border-white/[0.12]">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <select
        value={current}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="appearance-none bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
      >
        {anos.map((ano) => (
          <option key={ano} value={ano} className="bg-[#1B3FB8] text-white">
            {ano}
          </option>
        ))}
      </select>
      <ChevronDown size={10} className="pointer-events-none shrink-0 text-white/70" />
    </div>
  );
}

export function AnoLetivoPicker({ anos }: Props) {
  return (
    <Suspense fallback={
      <div className="inline-flex items-center h-[30px] px-2.5 rounded-[7px] text-[11.5px] font-medium text-white/70 bg-white/10 border border-white/[0.12]">
        <span className="text-white font-semibold">{new Date().getFullYear()}</span>
      </div>
    }>
      <AnoLetivoPickerInner anos={anos} />
    </Suspense>
  );
}
