"use client";

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
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        title="Sair do sistema"
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
    </form>
  );
}
