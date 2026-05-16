"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { shiftUrlMonth, monthLabel } from "@/lib/payroll/date-utils";

export function MonthNav({ mes }: { mes: string }) {
  const prev = shiftUrlMonth(mes, -1);
  const next = shiftUrlMonth(mes, 1);

  return (
    <div className="inline-flex items-center gap-2">
      <Link
        href={`/rh/folha/${prev}`}
        className="ds-button ds-button-secondary px-2"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={14} />
      </Link>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-ui border border-line bg-surface text-sm font-semibold text-ink min-w-[160px] justify-center">
        <Calendar size={14} className="text-ink/55" />
        {monthLabel(mes)}
      </div>
      <Link
        href={`/rh/folha/${next}`}
        className="ds-button ds-button-secondary px-2"
        aria-label="Próximo mês"
      >
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}
