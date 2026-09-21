"use client";

import { useState, useRef } from "react";
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = ICON_MAP[item.iconName] ?? ICON_MAP.FileText;

  function openNow() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenSub(true);
  }
  function closeSoon() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenSub(false), 180);
  }
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
        style={
          active
            ? { color: "var(--brand-600)", background: "color-mix(in oklab, var(--brand-600) 8%, var(--surface))" }
            : { color: "var(--text-soft)" }
        }
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2 text-[12px] rounded-[7px] transition-colors duration-100",
          active ? "font-semibold" : "font-medium hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
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
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        type="button"
        onClick={() => setOpenSub((v) => !v)}
        style={
          branchActive
            ? { color: "var(--brand-600)", background: "color-mix(in oklab, var(--brand-600) 8%, var(--surface))" }
            : { color: "var(--text-soft)" }
        }
        className={cn(
          "flex w-full items-center gap-2.5 px-2.5 py-2 text-[12px] rounded-[7px] transition-colors duration-100",
          branchActive ? "font-semibold" : "font-medium hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        )}
      >
        <Icon size={13} strokeWidth={branchActive ? 2 : 1.7} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronRight size={12} strokeWidth={2} style={{ color: "var(--text-faint)" }} />
      </button>

      {openSub ? (
        <div
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)" }}
          className="absolute left-full top-0 ml-1 w-[190px] p-1 before:absolute before:right-full before:top-0 before:h-full before:w-2 before:content-['']">
          {item.children.map((child) => {
            const ChildIcon = ICON_MAP[child.iconName] ?? ICON_MAP.FileText;
            const active = pathname === child.href || pathname.startsWith(`${child.href}/`);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                style={
                  active
                    ? { color: "var(--brand-600)", background: "color-mix(in oklab, var(--brand-600) 8%, var(--surface))" }
                    : { color: "var(--text-soft)" }
                }
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 text-[12px] rounded-[7px] transition-colors duration-100",
                  active ? "font-semibold" : "font-medium hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
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
