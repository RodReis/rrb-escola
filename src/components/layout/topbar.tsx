import Link from "next/link";
import { TopbarNavLink, type TopbarIconName } from "@/components/layout/topbar-nav-link";
import { SecretariaDropdown } from "@/components/layout/secretaria-dropdown";
import { RhDropdown } from "@/components/layout/rh-dropdown";
import { FinanceiroDropdown } from "@/components/layout/financeiro-dropdown";
import { ConfiguracoesDropdown } from "@/components/layout/configuracoes-dropdown";
import { NotificationBell } from "@/components/layout/notification-bell";
import { TopbarUserCard } from "@/components/layout/topbar-user-card";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionProfile } from "@/lib/auth/session";
import { listNotificacoes } from "@/lib/data/notificacoes";
import { School } from "lucide-react";

const primaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/portaria", label: "Portaria", icon: "DoorOpen" }
];

const secondaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/frequencias", label: "Frequência", icon: "CalendarCheck" },
  { href: "/relatorios/alunos", label: "Rel. Alunos", icon: "UsersRound" },
  { href: "/relatorios/frequencia", label: "Rel. Frequência", icon: "CalendarCheck" }
];

function BrandBlock() {
  return (
    <div className="flex items-center gap-2.5 pr-4 border-r border-white/[0.12] shrink-0">
      <div className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.20),inset_0_-1px_0_rgba(0,0,0,0.05)]">
        <span className="absolute -right-1.5 top-0 h-9 w-5 rotate-[34deg] bg-[#ff2424] opacity-80" />
        <School className="relative z-10 text-[#1B3FB8]" size={16} strokeWidth={2} />
      </div>
      <div className="leading-[1.15] min-w-0">
        <div className="text-[12.5px] font-semibold text-white tracking-[-0.005em]">RRB Escola</div>
        <div className="text-[10px] text-white/50 mt-px tracking-[-0.003em]">Sistemas de Gestão Escolar</div>
      </div>
    </div>
  );
}

export async function Topbar({ perfil }: { perfil: SessionProfile }) {
  const notifs = await listNotificacoes(perfil.id, perfil.escola_id, 20);
  return (
    <header
      className="sticky top-0 z-50 border-b border-black/20"
      style={{
        height: 56,
        background: "linear-gradient(180deg, #1B3FB8 0%, #15349E 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3.5 px-4 sm:px-6 lg:px-8">
      <Link href="/" className="shrink-0">
        <BrandBlock />
      </Link>

      <nav
        className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden h-full py-0"
        style={{ scrollbarWidth: "none" }}
      >
        {primaryItems.map((item) => (
          <TopbarNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="primary" />
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-white/20" />
        {secondaryItems.map((item) => (
          <TopbarNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="secondary" />
        ))}
      </nav>

      <div className="flex items-center gap-0.5 shrink-0">
        <FinanceiroDropdown />
        <SecretariaDropdown />
        <RhDropdown />
        <ConfiguracoesDropdown />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Year picker */}
        <button className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[7px] text-[11.5px] font-medium text-white/70 bg-white/10 border border-white/[0.12] cursor-pointer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className="text-white">2026.1</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <NotificationBell perfilId={perfil.id} escolaId={perfil.escola_id} initial={notifs} />

        {/* User card */}
        <TopbarUserCard perfil={perfil} logoutAction={logoutAction} />
      </div>
      </div>
    </header>
  );
}
