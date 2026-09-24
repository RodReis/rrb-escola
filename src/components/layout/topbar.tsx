import Link from "next/link";
import { TopbarNavLink, type TopbarIconName } from "@/components/layout/topbar-nav-link";
import { SecretariaDropdown, type DropdownItem } from "@/components/layout/secretaria-dropdown";
import { RhDropdown } from "@/components/layout/rh-dropdown";
import { FinanceiroDropdown } from "@/components/layout/financeiro-dropdown";
import { ComercialDropdown } from "@/components/layout/comercial-dropdown";
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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { can, ROTA_PARA_MODULO, type PermissionMap } from "@/lib/auth/permissions";
import { FEATURES } from "@/lib/config/features";

const primaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  // WhatsApp fica atrás de feature flag (NEXT_PUBLIC_FEATURE_WHATSAPP).
  ...(FEATURES.whatsapp
    ? ([{ href: "/whatsapp", label: "WhatsApp", icon: "Inbox" }] as const)
    : []),
];

const RELATORIOS_ITEMS: DropdownItem[] = [
  { href: "/relatorios/alunos", label: "Rel. Alunos", iconName: "UsersRound" },
  { href: "/relatorios/frequencia", label: "Rel. Frequência", iconName: "CalendarCheck" },
  { href: "/relatorios/inadimplencia", label: "Inadimplência", iconName: "AlertCircle" },
  { href: "/relatorios/comercial", label: "Rel. Comercial", iconName: "BarChart3" },
  { href: "/relatorios/dre", label: "DRE / Resultado", iconName: "BarChart3" },
];

const SECRETARIA_ITEMS: DropdownItem[] = [
  {
    href: "/alunos",
    label: "Aluno",
    iconName: "UsersRound",
    children: [
      { href: "/alunos", label: "Alunos", iconName: "UsersRound" },
      { href: "/matriculas", label: "Matrículas", iconName: "FileText" },
      { href: "/bolsistas", label: "Bolsistas", iconName: "HandHeart" },
      { href: "/avaliacoes", label: "Avaliações", iconName: "ClipboardCheck" },
      { href: "/frequencias", label: "Frequência", iconName: "CalendarCheck" },
      { href: "/mural/aniversariantes", label: "Mural aniversários", iconName: "Cake" },
    ],
  },
  {
    href: "/series",
    label: "Acadêmico",
    iconName: "GraduationCap",
    children: [
      { href: "/series", label: "Séries", iconName: "Layers3" },
      { href: "/turmas", label: "Turmas", iconName: "GraduationCap" },
      { href: "/disciplinas", label: "Disciplinas", iconName: "ClipboardList" },
      { href: "/professores/atribuicoes", label: "Atribuições", iconName: "UserCheck" },
      { href: "/declaracoes/modelos", label: "Declarações", iconName: "FileText" },
    ],
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    iconName: "Kanban",
    children: [
      { href: "/pipeline", label: "Kanban", iconName: "Kanban" },
      { href: "/pipeline/config", label: "Configurar quadros", iconName: "Settings2" },
    ],
  },
  {
    href: "/historico/associacoes",
    label: "Histórico Escolar",
    iconName: "FileText",
    children: [
      { href: "/historico/associacoes", label: "Associações", iconName: "FileText" },
      { href: "/historico/notas", label: "Entrada de Notas", iconName: "FileText" },
      { href: "/historico/emissao", label: "Emissão", iconName: "FileText" },
      { href: "/historico/certificado", label: "Certificado", iconName: "FileText" },
    ],
  },
  { href: "/portaria", label: "Portaria", iconName: "DoorOpen" },
  { href: "/organograma", label: "Organograma", iconName: "Network" },
  { href: "/calendario", label: "Calendário Letivo", iconName: "CalendarDays" },
  { href: "/eventos", label: "Eventos", iconName: "CalendarHeart" },
  { href: "/importacoes", label: "Importações", iconName: "Inbox" },
];

const COMERCIAL_ITEMS: DropdownItem[] = [
  { href: "/comercial/produtos", label: "Produtos", iconName: "Tags" },
  { href: "/comercial/vendas", label: "Vendas", iconName: "Receipt" },
  { href: "/comercial/estoque", label: "Estoque", iconName: "Layers3" },
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
  {
    href: "/financeiro/tesouraria",
    label: "Tesouraria",
    iconName: "Wallet",
    children: [
      { href: "/financeiro/tesouraria", label: "Contas", iconName: "Wallet" },
      { href: "/financeiro/tesouraria/cobrancas-pix", label: "Cobranças Pix", iconName: "Receipt" },
      { href: "/financeiro/tesouraria/conciliacao", label: "Conciliação", iconName: "ReceiptText" },
    ],
  },
  {
    href: "/financeiro/isaac",
    label: "Repasse isaac",
    iconName: "Receipt",
    children: [
      { href: "/financeiro/isaac", label: "Importar repasse", iconName: "Receipt" },
      { href: "/financeiro/isaac/pendencias", label: "Pendências", iconName: "ReceiptText" },
    ],
  },
  { href: "/financeiro/lancamentos", label: "Livro-Razão", iconName: "ReceiptText" },
  { href: "/financeiro/contratos", label: "Contratos de Receita", iconName: "FileText" },
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
  { href: "/financeiro/lancamentos/categorias", label: "Categorias financeiras", iconName: "Tags" },
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
    <div className="flex items-center gap-2.5 pr-4 border-r border-line shrink-0">
      <div
        className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden shadow-xs"
        style={{ borderRadius: "var(--r-md)", background: "linear-gradient(150deg, var(--brand-500), var(--brand-700))" }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={nome} className="h-full w-full object-contain p-0.5" />
        ) : (
          <School className="relative z-10 text-white" size={16} strokeWidth={2} />
        )}
      </div>
      <div className="leading-[1.15] min-w-0">
        <div className="font-display text-[13px] font-semibold text-ink tracking-[-0.01em]">{nome}</div>
        <div className="text-[10px] mt-px tracking-[-0.003em]" style={{ color: "var(--text-muted)" }}>
          Sistemas de Gestão Escolar
        </div>
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
  const comercialItems = filterByPermissions(COMERCIAL_ITEMS, permissions, isAdmin);
  const rhItems = filterByPermissions(RH_ITEMS, permissions, isAdmin);
  const financeiroItems = filterByPermissions(FINANCEIRO_ITEMS, permissions, isAdmin);
  const configItems = filterByPermissions(CONFIG_ITEMS, permissions, isAdmin);
  const relatoriosItems = filterByPermissions(RELATORIOS_ITEMS, permissions, isAdmin);

  return (
    <header
      className="sticky top-0 z-50 border-b border-line"
      style={{
        height: 62,
        background: "var(--surface)",
        boxShadow: "var(--shadow-xs)",
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
        <ComercialDropdown items={comercialItems} />
        <SecretariaDropdown items={secretariaItems} />
        <RhDropdown items={rhItems} />
        <ConfiguracoesDropdown items={configItems} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />

        <NotificationBell perfilId={perfil.id} escolaId={perfil.escola_id} initial={notifs} />

        {/* User card */}
        <TopbarUserCard perfil={perfil} logoutAction={logoutAction} avatarUrl={avatarUrl} />
      </div>
      </div>
    </header>
  );
}
