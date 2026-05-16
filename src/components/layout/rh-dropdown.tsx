"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, UsersRound, Wallet, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const rhItems = [
  { href: "/rh/empresas", label: "Empresas", icon: Building2 },
  { href: "/rh/funcionarios", label: "Funcionários", icon: UsersRound },
  { href: "/rh/folha", label: "Folha", icon: Wallet },
  { href: "/rh/brackets", label: "Brackets", icon: SlidersHorizontal }
];

const rhHrefs = rhItems.map((i) => i.href);

export function RhDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const isActive = rhHrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));

  useEffect(() => { setMounted(true); }, []);

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
    setPos({ left: r.left, top: r.bottom + 6, width: 192 });
  }, [open]);

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
        <Briefcase size={13} strokeWidth={isActive ? 2 : 1.7} />
        RH
        <ChevronDown size={11} strokeWidth={2} className={cn("transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && mounted
        ? createPortal(
            <div
              style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 9999 }}
              className="rounded-[10px] border border-[#1B3FB8]/20 bg-white shadow-[0_14px_40px_-10px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)] p-1"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {rhItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 text-[12px] rounded-[7px] transition-colors duration-100",
                      active
                        ? "bg-[#1B3FB8]/[0.07] font-semibold text-[#1B3FB8]"
                        : "font-medium text-[#1A2240] hover:bg-slate-50"
                    )}
                  >
                    <Icon size={13} strokeWidth={active ? 2 : 1.7} />
                    {item.label}
                  </Link>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
