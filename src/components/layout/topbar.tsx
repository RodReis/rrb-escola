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
import { createServerClient } from "@/lib/supabase/server";
import { getPublicUrl } from "@/lib/storage/public-urls";
import { School } from "lucide-react";
import { AnoLetivoPicker } from "@/components/layout/ano-letivo-picker";

const primaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" }
];

const secondaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/relatorios/alunos", label: "Rel. Alunos", icon: "UsersRound" },
  { href: "/relatorios/frequencia", label: "Rel. Frequência", icon: "CalendarCheck" }
];

function BrandBlock({ logoUrl, nome }: { logoUrl: string | null; nome: string }) {
  return (
    <div className="flex items-center gap-2.5 pr-4 border-r border-white/[0.12] shrink-0">
      <div className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.20),inset_0_-1px_0_rgba(0,0,0,0.05)]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={nome} className="h-full w-full object-contain p-0.5" />
        ) : (
          <>
            <span className="absolute -right-1.5 top-0 h-9 w-5 rotate-[34deg] bg-[#ff2424] opacity-80" />
            <School className="relative z-10 text-[#1B3FB8]" size={16} strokeWidth={2} />
          </>
        )}
      </div>
      <div className="leading-[1.15] min-w-0">
        <div className="text-[12.5px] font-semibold text-white tracking-[-0.005em]">{nome}</div>
        <div className="text-[10px] text-white/50 mt-px tracking-[-0.003em]">Sistemas de Gestão Escolar</div>
      </div>
    </div>
  );
}

export async function Topbar({ perfil, anosLetivos }: { perfil: SessionProfile; anosLetivos: number[] }) {
  const supabase = await createServerClient();
  const [notifs, escolaRes, perfilRes] = await Promise.all([
    listNotificacoes(perfil.id, perfil.escola_id, 20),
    supabase.from("escolas").select("nome, logo_url").eq("id", perfil.escola_id).maybeSingle(),
    supabase.from("perfis").select("foto_url").eq("id", perfil.id).maybeSingle(),
  ]);
  const escolaNome = escolaRes.data?.nome ?? "RRB Escola";
  const [logoUrl, avatarUrl] = await Promise.all([
    getPublicUrl("escola-logos", escolaRes.data?.logo_url),
    getPublicUrl("perfis-fotos", perfilRes.data?.foto_url),
  ]);

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
        <BrandBlock logoUrl={logoUrl} nome={escolaNome} />
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
        <AnoLetivoPicker anos={anosLetivos} />

        <NotificationBell perfilId={perfil.id} escolaId={perfil.escola_id} initial={notifs} />

        {/* User card */}
        <TopbarUserCard perfil={perfil} logoutAction={logoutAction} avatarUrl={avatarUrl} />
      </div>
      </div>
    </header>
  );
}
