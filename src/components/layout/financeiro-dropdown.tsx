"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DropdownItem } from "./secretaria-dropdown";
import { SubmenuItem, hrefsOf } from "./dropdown-submenu-item";

export function FinanceiroDropdown({ items }: { items: DropdownItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const isActive = hrefsOf(items).some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6, width: 200 });
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={
          isActive || open
            ? { color: "var(--brand-600)", background: "color-mix(in oklab, var(--brand-600) 12%, var(--surface))" }
            : { color: "var(--text-muted)" }
        }
        className={cn(
          "inline-flex h-[34px] shrink-0 items-center gap-[7px] rounded-[9px] px-3 text-[12.5px] font-semibold no-underline outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-600)]/40 transition-all duration-150",
          !isActive && !open && "hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        )}
      >
        <BarChart3 size={13} strokeWidth={isActive ? 2 : 1.7} />
        Financeiro
        <ChevronDown size={11} strokeWidth={2} className={cn("transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && mounted
        ? createPortal(
            <div
              style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 9999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)" }}
              className="p-1"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {items.map((item) => (
                <SubmenuItem key={item.href} item={item} pathname={pathname} onNavigate={() => setOpen(false)} />
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
