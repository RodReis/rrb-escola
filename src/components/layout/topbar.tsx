import Link from "next/link";
import { TopbarNavLink, type TopbarIconName } from "@/components/layout/topbar-nav-link";
import { SecretariaDropdown, type DropdownItem } from "@/components/layout/secretaria-dropdown";
import { RhDropdown } from "@/components/layout/rh-dropdown";
import { FinanceiroDropdown } from "@/components/layout/financeiro-dropdown";
import { ConfiguracoesDropdown } from "@/components/layout/configuracoes-dropdown";
import { RelatoriosDropdown } from "@/components/layout/relatorios-dropdown";
import { NotificationBell } from "@/components/layout/notification-bell";
import { TopbarUserCard } from "@/components/layout/topbar-user-card";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionProfile } from "@/lib/auth/session";
import { listNotificacoes } from "@/lib/data/notificacoes";
import { createServerClient } from "@/lib/supabase/server";
import { getPublicUrl } from "@/lib/storage/public-urls";
import { School } from "lucide-react";
import { AnoLetivoPicker } from "@/components/layout/ano-letivo-picker";
import { can, ROTA_PARA_MODULO, type PermissionMap } from "@/lib/auth/permissions";

const primaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" }
];

const RELATORIOS_ITEMS: DropdownItem[] = [
  { href: "/relatorios/alunos", label: "Rel. Alunos", iconName: "UsersRound" },
  { href: "/relatorios/frequencia", label: "Rel. Frequência", iconName: "CalendarCheck" },
  { href: "/relatorios/inadimplencia", label: "Inadimplência", iconName: "AlertCircle" },
];

const SECRETARIA_ITEMS: DropdownItem[] = [
  { href: "/alunos", label: "Alunos", iconName: "UsersRound" },
  { href: "/bolsistas", label: "Bolsistas", iconName: "HandHeart" },
  { href: "/matriculas", label: "Matrículas", iconName: "FileText" },
  { href: "/series", label: "Séries", iconName: "Layers3" },
  { href: "/turmas", label: "Turmas", iconName: "GraduationCap" },
  { href: "/disciplinas", label: "Disciplinas", iconName: "ClipboardList" },
  { href: "/avaliacoes", label: "Avaliações", iconName: "ClipboardCheck" },
  { href: "/professores/atribuicoes", label: "Atribuições", iconName: "UserCheck" },
  { href: "/frequencias", label: "Frequência", iconName: "CalendarCheck" },
  { href: "/portaria", label: "Portaria", iconName: "DoorOpen" },
  { href: "/mural/aniversariantes", label: "Mural aniversários", iconName: "Cake" },
  { href: "/organograma", label: "Organograma", iconName: "Network" },
  { href: "/calendario", label: "Calendário Letivo", iconName: "CalendarDays" },
  { href: "/eventos", label: "Eventos", iconName: "CalendarHeart" },
  { href: "/importacoes", label: "Importações", iconName: "Inbox" },
];

const RH_ITEMS: DropdownItem[] = [
  { href: "/rh/empresas", label: "Empresas", iconName: "Building2" },
  { href: "/rh/funcionarios", label: "Funcionários", iconName: "UsersRound" },
  { href: "/rh/brackets", label: "Brackets", iconName: "SlidersHorizontal" },
  { href: "/rh/documentos", label: "Documentos", iconName: "FileText" },
  { href: "/calendario", label: "Calendário Letivo", iconName: "CalendarDays" },
  { href: "/comunicados", label: "Comunicados", iconName: "Megaphone" },
  { href: "/configuracoes/lembretes", label: "Lembretes", iconName: "BellRing" },
];

const FINANCEIRO_ITEMS: DropdownItem[] = [
  { href: "/financeiro", label: "Financeiro", iconName: "BarChart3" },
  { href: "/financeiro/alunos-sem-valor", label: "Sem valor / Descontos", iconName: "AlertTriangle" },
  { href: "/despesas", label: "Despesas", iconName: "Receipt" },
  { href: "/valores-praticados", label: "Valores praticados", iconName: "ReceiptText" },
  { href: "/planos", label: "Planos", iconName: "CreditCard" },
  {
    href: "/rh/folha-v2",
    label: "Folha",
    iconName: "Wallet",
    children: [
      { href: "/rh/folha-v2", label: "Folhas", iconName: "Wallet" },
      { href: "/rh/folha-v2/contratos", label: "Contratos", iconName: "FileText" },
      { href: "/rh/folha-v2/rubricas", label: "Rubricas", iconName: "Tags" },
      { href: "/rh/folha-v2/perfis", label: "Perfis de Cálculo", iconName: "Layers3" },
      { href: "/rh/folha-v2/ferias", label: "Férias", iconName: "CalendarOff" },
      { href: "/rh/folha-v2/provisoes", label: "Provisões", iconName: "Receipt" },
      { href: "/rh/folha-v2/config", label: "Config. Folha", iconName: "Settings2" },
      { href: "/rh/folha-v2/historico", label: "Histórico", iconName: "History" },
    ],
  },
];

const CONFIG_ITEMS: DropdownItem[] = [
  { href: "/configuracoes/escola", label: "Dados da escola", iconName: "School" },
  { href: "/usuarios", label: "Usuários", iconName: "UsersRound" },
  { href: "/configuracoes/perfis", label: "Perfis e Permissões", iconName: "ShieldCheck" },
  { href: "/configuracoes/webhook", label: "Webhook", iconName: "Webhook" },
  { href: "/despesas/categorias", label: "Categorias despesa", iconName: "Tags" },
];

function filterByPermissions(
  items: DropdownItem[],
  perms: PermissionMap,
  isAdmin: boolean,
): DropdownItem[] {
  if (isAdmin) return items;
  return items
    .map((item) => {
      if (!item.children) return item;
      const children = item.children.filter((child) => {
        const m = ROTA_PARA_MODULO[child.href];
        return !m || can(perms, m, "read");
      });
      return { ...item, children };
    })
    .filter((item) => {
      const modulo = ROTA_PARA_MODULO[item.href];
      const selfOk = !modulo || can(perms, modulo, "read");
      // item com filhos: visível se o próprio passa OU sobrou algum filho
      if (item.children) return selfOk || item.children.length > 0;
      return selfOk;
    });
}

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

export async function Topbar({
  perfil,
  anosLetivos,
  permissions,
}: {
  perfil: SessionProfile;
  anosLetivos: number[];
  permissions: PermissionMap;
}) {
  const supabase = await createServerClient();
  const [notifs, escolaRes, perfilRes] = await Promise.all([
    listNotificacoes(perfil.id, perfil.escola_id, 20),
    supabase.from("escolas").select("nome, logo_url").eq("id", perfil.escola_id).maybeSingle(),
    supabase.from("perfis").select("foto_url").eq("id", perfil.id).maybeSingle(),
  ]);
  const escolaNome = escolaRes.data?.nome ?? "CRM Escola";
  const [logoUrl, avatarUrl] = await Promise.all([
    getPublicUrl("escola-logos", escolaRes.data?.logo_url),
    getPublicUrl("perfis-fotos", perfilRes.data?.foto_url),
  ]);

  const isAdmin = perfil.perfil === "admin";
  const secretariaItems = filterByPermissions(SECRETARIA_ITEMS, permissions, isAdmin);
  const rhItems = filterByPermissions(RH_ITEMS, permissions, isAdmin);
  const financeiroItems = filterByPermissions(FINANCEIRO_ITEMS, permissions, isAdmin);
  const configItems = filterByPermissions(CONFIG_ITEMS, permissions, isAdmin);
  const relatoriosItems = filterByPermissions(RELATORIOS_ITEMS, permissions, isAdmin);

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
        className="no-scrollbar flex shrink-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden h-full py-0"
        style={{ scrollbarWidth: "none" }}
      >
        {primaryItems.map((item) => (
          <TopbarNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="primary" />
        ))}
      </nav>

      <div className="flex items-center gap-0.5 shrink-0">
        <RelatoriosDropdown items={relatoriosItems} />
        <FinanceiroDropdown items={financeiroItems} />
        <SecretariaDropdown items={secretariaItems} />
        <RhDropdown items={rhItems} />
        <ConfiguracoesDropdown items={configItems} />
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
