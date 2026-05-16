"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Inbox,
  Layers3,
  Network,
  UsersRound,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

const secretariaItems = [
  { href: "/alunos", label: "Alunos", icon: UsersRound },
  { href: "/matriculas", label: "Matrículas", icon: FileText },
  { href: "/series", label: "Séries", icon: Layers3 },
  { href: "/turmas", label: "Turmas", icon: GraduationCap },
  { href: "/organograma", label: "Organograma", icon: Network },
  { href: "/importacoes", label: "Importações", icon: Inbox }
];

const secretariaHrefs = secretariaItems.map((i) => i.href);

export function SecretariaDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = secretariaHrefs.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-ui px-3 text-sm font-black transition",
          isActive
            ? "bg-brand text-paper shadow-soft"
            : "text-ink hover:bg-muted"
        )}
      >
        <BookOpen size={17} />
        Secretaria
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-ui border border-line bg-surface shadow-soft">
          {secretariaItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition first:rounded-t-ui last:rounded-b-ui",
                  active
                    ? "bg-brand/10 font-black text-brand"
                    : "font-medium text-ink hover:bg-muted"
                )}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
