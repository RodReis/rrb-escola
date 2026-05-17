"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, Settings, LogOut } from "lucide-react";
import type { SessionProfile } from "@/lib/auth/session";

function getInitials(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function TopbarUserCard({
  perfil,
  logoutAction,
}: {
  perfil: SessionProfile;
  logoutAction: () => Promise<void>;
}) {
  const initials = getInitials(perfil.nome);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Conta"
        className="inline-flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-[8px] border border-white/[0.12] bg-white/10 cursor-pointer hover:bg-white/[0.18] transition-colors"
      >
        <div className="text-right leading-[1.15]">
          <div className="text-[11.5px] font-semibold text-white">{perfil.nome.split(" ")[0]}</div>
          <div className="text-[9.5px] text-white/50 truncate max-w-[120px]">{perfil.email}</div>
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7B72] to-[#C81515] text-white text-[10px] font-bold tracking-tight">
          {initials}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[200px] rounded-[10px] border border-[#1B3FB8]/20 bg-white shadow-[0_14px_40px_-10px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)] p-1 z-50">
          <Link
            href="/meu-perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-[12px] font-medium text-[#1A2240] rounded-[7px] hover:bg-slate-50"
          >
            <User size={13} />
            Meu perfil
          </Link>
          {perfil.perfil === "admin" && (
            <Link
              href="/configuracoes/escola"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2.5 py-2 text-[12px] font-medium text-[#1A2240] rounded-[7px] hover:bg-slate-50"
            >
              <Settings size={13} />
              Dados da escola
            </Link>
          )}
          <div className="my-1 h-px bg-slate-200" />
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-2.5 py-2 text-[12px] font-medium text-danger rounded-[7px] hover:bg-danger/10"
            >
              <LogOut size={13} />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
