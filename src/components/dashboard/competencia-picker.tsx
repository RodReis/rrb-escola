"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function buildOptions(months: number): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    out.push({
      value: `${y}-${pad(m)}`,
      label: `${MESES[m - 1]}/${y}`,
    });
  }
  return out;
}

export function CompetenciaPicker({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const options = buildOptions(13);

  function handleChange(value: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("competencia", value);
    router.push(`/?${sp.toString()}`);
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-ui border border-line bg-surface px-3 py-1.5 text-sm">
      <Calendar size={14} className="text-ink/55" />
      <span className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Mês</span>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent text-sm font-semibold text-ink focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
