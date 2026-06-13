"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DropdownItem } from "./secretaria-dropdown";
import { ICON_MAP } from "./dropdown-icons";

function hrefsOf(items: DropdownItem[]): string[] {
  return items.flatMap((i) => [i.href, ...(i.children ? hrefsOf(i.children) : [])]);
}

function SubmenuItem({
  item,
  pathname,
  onNavigate,
}: {
  item: DropdownItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const [openSub, setOpenSub] = useState(false);
  const Icon = ICON_MAP[item.iconName] ?? ICON_MAP.FileText;
  const childHrefs = item.children ? hrefsOf(item.children) : [];
  const branchActive =
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    childHrefs.some((h) => pathname === h || pathname.startsWith(`${h}/`));

  if (!item.children || item.children.length === 0) {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
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
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpenSub(true)}
      onMouseLeave={() => setOpenSub(false)}
    >
      <button
        type="button"
        onClick={() => setOpenSub((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 px-2.5 py-2 text-[12px] rounded-[7px] transition-colors duration-100",
          branchActive
            ? "bg-[#1B3FB8]/[0.07] font-semibold text-[#1B3FB8]"
            : "font-medium text-[#1A2240] hover:bg-slate-50"
        )}
      >
        <Icon size={13} strokeWidth={branchActive ? 2 : 1.7} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronRight size={12} strokeWidth={2} className="text-[#1A2240]/40" />
      </button>

      {openSub ? (
        <div
          className="absolute left-full top-0 ml-1 w-[190px] rounded-[10px] border border-[#1B3FB8]/20 bg-white shadow-[0_14px_40px_-10px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)] p-1"
        >
          {item.children.map((child) => {
            const ChildIcon = ICON_MAP[child.iconName] ?? ICON_MAP.FileText;
            const active = pathname === child.href || pathname.startsWith(`${child.href}/`);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 text-[12px] rounded-[7px] transition-colors duration-100",
                  active
                    ? "bg-[#1B3FB8]/[0.07] font-semibold text-[#1B3FB8]"
                    : "font-medium text-[#1A2240] hover:bg-slate-50"
                )}
              >
                <ChildIcon size={13} strokeWidth={active ? 2 : 1.7} />
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
        className={cn(
          "inline-flex h-[30px] shrink-0 items-center gap-[7px] rounded-[7px] px-2.5 text-[12px] font-semibold no-underline outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-150",
          isActive
            ? "bg-white text-[#1B3FB8] shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_6px_14px_-6px_rgba(0,0,0,0.25)]"
            : "text-white/70 hover:bg-white/[0.18] hover:text-white"
        )}
      >
        <BarChart3 size={13} strokeWidth={isActive ? 2 : 1.7} />
        Financeiro
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
