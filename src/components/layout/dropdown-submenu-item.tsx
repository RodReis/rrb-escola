"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DropdownItem } from "./secretaria-dropdown";
import { ICON_MAP } from "./dropdown-icons";

export function hrefsOf(items: DropdownItem[]): string[] {
  return items.flatMap((i) => [i.href, ...(i.children ? hrefsOf(i.children) : [])]);
}

// Item de dropdown que renderiza um link simples ou, se tiver children,
// um sub-menu lateral. Compartilhado por Financeiro e Secretaria.
export function SubmenuItem({
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
        <div className="absolute left-full top-0 ml-1 w-[190px] rounded-[10px] border border-[#1B3FB8]/20 bg-white shadow-[0_14px_40px_-10px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)] p-1">
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
