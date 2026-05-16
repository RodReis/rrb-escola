import Link from "next/link";
import { TopbarNavLink, type TopbarIconName } from "@/components/layout/topbar-nav-link";
import { SecretariaDropdown } from "@/components/layout/secretaria-dropdown";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogOut, School } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionProfile } from "@/lib/auth/session";

const primaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/financeiro", label: "Financeiro", icon: "BarChart3" },
  { href: "/portaria", label: "Portaria", icon: "DoorOpen" }
];

const secondaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/usuarios", label: "Usuários", icon: "UsersRound" },
  { href: "/planos", label: "Planos", icon: "CreditCard" },
  { href: "/frequencias", label: "Frequência", icon: "CalendarCheck" },
  { href: "/relatorios/alunos", label: "Rel. Alunos", icon: "UsersRound" },
  { href: "/relatorios/inadimplencia", label: "Inadimplência", icon: "ReceiptText" },
  { href: "/relatorios/frequencia", label: "Rel. Frequência", icon: "CalendarCheck" }
];

function BrandMark() {
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-ui bg-brand text-paper">
      <span className="absolute -right-2 top-0 h-14 w-8 rotate-[34deg] bg-accent" />
      <School className="relative z-10" size={22} />
    </span>
  );
}

export function Topbar({ perfil }: { perfil: SessionProfile }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-[190px] items-center gap-3">
          <BrandMark />
          <span className="leading-none">
            <strong className="block text-lg font-black text-ink">Lectiva</strong>
            <small className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-accent">RRB Escola</small>
          </span>
        </Link>

        <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-3">
          {primaryItems.map((item) => (
            <TopbarNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="primary" />
          ))}
          <SecretariaDropdown />
          <span className="mx-2 h-7 w-px shrink-0 bg-line" />
          {secondaryItems.map((item) => (
            <TopbarNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="secondary" />
          ))}
        </nav>

        <ThemeToggle className="shrink-0" />
        <div className="hidden text-right text-xs leading-tight md:block">
          <strong className="block font-bold text-ink">{perfil.nome}</strong>
          <span className="block font-medium text-muted">{perfil.email}</span>
        </div>
        <form action={logoutAction} className="shrink-0">
          <button className="ds-button ds-button-secondary h-10 min-h-10 px-3" title="Sair do sistema" aria-label="Sair do sistema">
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  );
}
