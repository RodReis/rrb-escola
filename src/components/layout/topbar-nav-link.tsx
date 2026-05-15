"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  Inbox,
  Layers3,
  LayoutDashboard,
  ReceiptText,
  UsersRound
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  BarChart3,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  Inbox,
  Layers3,
  LayoutDashboard,
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
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-ui px-3 text-sm transition",
        variant === "primary" ? "font-black" : "font-bold",
        active
          ? "bg-primary text-white shadow-soft hover:bg-primary hover:text-white"
          : variant === "primary"
            ? "text-ink hover:bg-muted"
            : "text-ink/70 hover:bg-muted hover:text-ink"
      )}
    >
      <Icon size={variant === "primary" ? 17 : 16} />
      {label}
    </Link>
  );
}
