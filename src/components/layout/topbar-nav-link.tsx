"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CreditCard,
  DoorOpen,
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
      className={cn(
        "inline-flex h-[30px] shrink-0 items-center gap-[7px] rounded-[7px] px-2.5 text-[12px] no-underline outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-150",
        variant === "primary" ? "font-semibold" : "font-medium",
        active
          ? "bg-white text-[#1B3FB8] shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_6px_14px_-6px_rgba(0,0,0,0.25)]"
          : "text-white/70 hover:bg-white/[0.18] hover:text-white"
      )}
    >
      <Icon size={13} strokeWidth={active ? 2 : 1.7} />
      {label}
    </Link>
  );
}
