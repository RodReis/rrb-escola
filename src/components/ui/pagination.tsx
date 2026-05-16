"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  total,
  onChange,
  windowSize = 3
}: {
  page: number;
  total: number;
  onChange: (next: number) => void;
  windowSize?: number;
}) {
  if (total <= 1) return null;
  const pages: (number | "...")[] = [];
  const start = Math.max(2, page - windowSize);
  const end = Math.min(total - 1, page + windowSize);
  pages.push(1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  if (total > 1) pages.push(total);

  return (
    <div className="ds-pager">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} aria-label="Anterior">
        <ChevronLeft size={14} />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-1 text-ink/40">…</span>
        ) : (
          <button key={p} data-active={p === page} onClick={() => onChange(p)}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onChange(Math.min(total, page + 1))} disabled={page === total} aria-label="Próximo">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
