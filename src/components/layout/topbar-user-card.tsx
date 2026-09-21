"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
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
  avatarUrl,
}: {
  perfil: SessionProfile;
  logoutAction: () => Promise<void>;
  avatarUrl?: string | null;
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
        className="inline-flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-[var(--r-sm)] border cursor-pointer transition-colors"
        style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
      >
        <div className="text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>
          {perfil.nome.split(" ")[0]}
        </div>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={perfil.nome} className="h-6 w-6 shrink-0 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-bold tracking-tight"
            style={{ background: "linear-gradient(135deg, var(--c-coral), #C81515)" }}
          >
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[200px] rounded-[var(--r-md)] border p-1 z-50"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <Link
            href="/meu-perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-[12px] font-medium rounded-[var(--r-sm)] transition-colors"
            style={{ color: "var(--text)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <User size={13} />
            Meu perfil
          </Link>
          <div className="my-1 h-px" style={{ background: "var(--border)" }} />
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-2.5 py-2 text-[12px] font-medium rounded-[var(--r-sm)] transition-colors"
              style={{ color: "var(--bad)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in oklab, var(--bad) 10%, transparent)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
