"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  FileOutput,
  FileText,
  GraduationCap,
  Inbox,
  Layers3,
  LayoutDashboard,
  Network,
  ReceiptText,
  UsersRound
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  FileOutput,
  FileText,
  GraduationCap,
  Inbox,
  Layers3,
  LayoutDashboard,
  Network,
  ReceiptText,
  UsersRound
};

export type TopbarIconName = keyof typeof icons;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopbarNavLink({
  href,
  label,
  icon,
  variant = "primary"
}: {
  href: string;
  label: string;
  icon: TopbarIconName;
  variant?: "primary" | "secondary";
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);
  const Icon = icons[icon];

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={
        active
          ? { color: "var(--brand-600)", background: "color-mix(in oklab, var(--brand-600) 12%, var(--surface))" }
          : { color: "var(--text-muted)" }
      }
      className={cn(
        "inline-flex h-[34px] shrink-0 items-center gap-[7px] rounded-[9px] px-3 text-[12.5px] no-underline outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-600)]/40 transition-all duration-150",
        active ? "font-semibold" : variant === "primary" ? "font-semibold" : "font-medium",
        !active && "hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
      )}
    >
      <Icon size={13} strokeWidth={active ? 2 : 1.7} />
      {label}
    </Link>
  );
}
