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
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-[30px] shrink-0 items-center gap-[7px] rounded-[7px] px-2.5 text-[12px] font-semibold transition-all duration-150",
          isActive
            ? "bg-white text-[#1B3FB8] shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_6px_14px_-6px_rgba(0,0,0,0.25)]"
            : "text-white/70 hover:bg-white/[0.18] hover:text-white"
        )}
      >
        <BookOpen size={13} strokeWidth={isActive ? 2 : 1.7} />
        Secretaria
        <ChevronDown size={11} strokeWidth={2} className={cn("transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-48 rounded-[10px] border border-[#1B3FB8]/20 bg-white shadow-[0_14px_40px_-10px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)] p-1">
          {secretariaItems.map((item) => {
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
        </div>
      )}
    </div>
  );
}
