"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubmenuItem, hrefsOf } from "./dropdown-submenu-item";

export type DropdownItem = {
  href: string;
  label: string;
  iconName: string;
  children?: DropdownItem[];
};

export function SecretariaDropdown({ items }: { items: DropdownItem[] }) {
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
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6, width: 192 });
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-[30px] shrink-0 items-center gap-[7px] rounded-[7px] px-2.5 text-[12px] font-semibold no-underline outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-150",
          isActive
            ? "bg-white text-[#1B3FB8] shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_6px_14px_-6px_rgba(0,0,0,0.25)]"
            : "text-white/70 hover:bg-white/[0.18] hover:text-white"
        )}
      >
        <BookOpen size={13} strokeWidth={isActive ? 2 : 1.7} />
        Secretaria
        <ChevronDown size={11} strokeWidth={2} className={cn("transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && mounted
        ? createPortal(
            <div
              style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 9999 }}
              className="rounded-[10px] border border-[#1B3FB8]/20 bg-white shadow-[0_14px_40px_-10px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)] p-1"
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
