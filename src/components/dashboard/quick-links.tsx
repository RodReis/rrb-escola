"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle, Award, BarChart3, BellRing, Building2, Cake, CalendarCheck,
  CalendarDays, CalendarHeart, ClipboardCheck, ClipboardList,
  CreditCard, DoorOpen, FileOutput, FileText, GraduationCap, HandHeart, Inbox,
  Kanban, Layers3, Link2, Megaphone, Network, Pencil, PenLine, Plus, Receipt, ReceiptText,
  School, ScrollText, Settings2, ShieldCheck, SlidersHorizontal, Tags, UserCheck,
  UsersRound, Wallet, Webhook, X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveQuickLinksAction } from "@/lib/actions/quick-links";

const MAX_LINKS = 12;

type RouteItem = { href: string; label: string; group: string; Icon: LucideIcon };

// Espelha os itens do menu (topbar.tsx). Manter sincronizado ao adicionar módulos.
const ALL_ROUTES: RouteItem[] = [
  // ── Secretaria ──
  { href: "/alunos",                       label: "Alunos",                group: "Secretaria",    Icon: UsersRound },
  { href: "/matriculas",                   label: "Matrículas",            group: "Secretaria",    Icon: FileText },
  { href: "/bolsistas",                    label: "Bolsistas",             group: "Secretaria",    Icon: HandHeart },
  { href: "/avaliacoes",                   label: "Avaliações",            group: "Secretaria",    Icon: ClipboardCheck },
  { href: "/frequencias",                  label: "Frequência",            group: "Secretaria",    Icon: CalendarCheck },
  { href: "/mural/aniversariantes",        label: "Mural aniversários",    group: "Secretaria",    Icon: Cake },
  { href: "/series",                       label: "Séries",                group: "Secretaria",    Icon: Layers3 },
  { href: "/turmas",                       label: "Turmas",                group: "Secretaria",    Icon: GraduationCap },
  { href: "/disciplinas",                  label: "Disciplinas",           group: "Secretaria",    Icon: ClipboardList },
  { href: "/professores/atribuicoes",      label: "Atribuições",           group: "Secretaria",    Icon: UserCheck },
  { href: "/historico/notas",              label: "Entrada de Notas",      group: "Secretaria",    Icon: PenLine },
  { href: "/historico/emissao",            label: "Histórico Escolar",     group: "Secretaria",    Icon: ScrollText },
  { href: "/declaracoes/modelos",          label: "Declarações",           group: "Secretaria",    Icon: FileText },
  { href: "/declaracoes/emitir",           label: "Emitir Declaração",     group: "Secretaria",    Icon: FileOutput },
  { href: "/historico/certificado",        label: "Certificado",           group: "Secretaria",    Icon: Award },
  { href: "/historico/associacoes",        label: "Assoc. Histórico",      group: "Secretaria",    Icon: Link2 },
  { href: "/pipeline",                     label: "Pipeline",              group: "Secretaria",    Icon: Kanban },
  { href: "/pipeline/config",              label: "Configurar quadros",    group: "Secretaria",    Icon: Settings2 },
  { href: "/portaria",                     label: "Portaria",              group: "Secretaria",    Icon: DoorOpen },
  { href: "/organograma",                  label: "Organograma",           group: "Secretaria",    Icon: Network },
  { href: "/calendario",                   label: "Calendário Letivo",     group: "Secretaria",    Icon: CalendarDays },
  { href: "/eventos",                      label: "Eventos",               group: "Secretaria",    Icon: CalendarHeart },
  { href: "/importacoes",                  label: "Importações",           group: "Secretaria",    Icon: Inbox },

  // ── Comercial ──
  { href: "/comercial/produtos",           label: "Produtos",              group: "Comercial",     Icon: Tags },
  { href: "/comercial/vendas",             label: "Vendas",                group: "Comercial",     Icon: Receipt },
  { href: "/comercial/estoque",            label: "Estoque",               group: "Comercial",     Icon: Layers3 },

  // ── Financeiro ──
  { href: "/financeiro",                   label: "Financeiro",            group: "Financeiro",    Icon: BarChart3 },
  { href: "/financeiro/lancamentos",       label: "Livro-Razão",           group: "Financeiro",    Icon: ReceiptText },
  { href: "/financeiro/contratos",         label: "Contratos de Receita",  group: "Financeiro",    Icon: FileText },
  { href: "/valores-praticados",           label: "Valores praticados",    group: "Financeiro",    Icon: ReceiptText },
  { href: "/planos",                       label: "Planos",                group: "Financeiro",    Icon: CreditCard },
  { href: "/rh/folha-v2",                  label: "Folha",                 group: "Financeiro",    Icon: Wallet },

  // ── RH ──
  { href: "/rh/empresas",                  label: "Empresas",              group: "RH",            Icon: Building2 },
  { href: "/rh/funcionarios",              label: "Funcionários",          group: "RH",            Icon: UsersRound },
  { href: "/rh/brackets",                  label: "Brackets",              group: "RH",            Icon: SlidersHorizontal },
  { href: "/rh/documentos",                label: "Documentos RH",         group: "RH",            Icon: FileText },
  { href: "/comunicados",                  label: "Comunicados",           group: "RH",            Icon: Megaphone },
  { href: "/configuracoes/lembretes",      label: "Lembretes",             group: "RH",            Icon: BellRing },

  // ── Relatórios ──
  { href: "/relatorios/alunos",            label: "Rel. Alunos",           group: "Relatórios",    Icon: UsersRound },
  { href: "/relatorios/frequencia",        label: "Rel. Frequência",       group: "Relatórios",    Icon: CalendarCheck },
  { href: "/relatorios/inadimplencia",     label: "Inadimplência",         group: "Relatórios",    Icon: AlertCircle },
  { href: "/relatorios/comercial",         label: "Rel. Comercial",        group: "Relatórios",    Icon: BarChart3 },
  { href: "/relatorios/dre",               label: "DRE / Resultado",       group: "Relatórios",    Icon: BarChart3 },

  // ── Configurações ──
  { href: "/configuracoes/escola",         label: "Dados da escola",       group: "Configurações", Icon: School },
  { href: "/usuarios",                     label: "Usuários",              group: "Configurações", Icon: UsersRound },
  { href: "/configuracoes/perfis",         label: "Perfis e Permissões",   group: "Configurações", Icon: ShieldCheck },
  { href: "/configuracoes/webhook",        label: "Webhook",               group: "Configurações", Icon: Webhook },
  { href: "/financeiro/lancamentos/categorias", label: "Categorias financeiras", group: "Configurações", Icon: Tags },
];

const GROUPS = ["Secretaria", "Comercial", "Financeiro", "RH", "Relatórios", "Configurações"];

function QuickLinkCard({ route }: { route: RouteItem }) {
  const { Icon, label, href } = route;
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-[10px] border border-line bg-surface p-3 shadow-soft transition-all duration-150 hover:border-brand/30 hover:shadow-md hover:-translate-y-0.5 min-w-[80px]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-brand/8 text-brand transition-colors group-hover:bg-brand/15">
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <span className="text-center text-[11px] font-semibold leading-tight text-ink/70 group-hover:text-ink line-clamp-2">
        {label}
      </span>
    </Link>
  );
}

function EditModal({
  current,
  allowedHrefs,
  onClose,
  onSave,
}: {
  current: string[];
  allowedHrefs: string[];
  onClose: () => void;
  onSave: (hrefs: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(current);

  function toggle(href: string) {
    setSelected((prev) =>
      prev.includes(href)
        ? prev.filter((h) => h !== href)
        : prev.length < MAX_LINKS
        ? [...prev, href]
        : prev
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-[14px] border border-line bg-surface shadow-[0_20px_60px_-10px_rgba(0,0,0,0.25)] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[14px] font-bold text-ink">Acesso rápido</h2>
            <p className="text-[12px] text-ink/60 mt-0.5">Selecione até {MAX_LINKS} atalhos ({selected.length}/{MAX_LINKS})</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-[7px] p-1.5 text-ink/40 hover:bg-muted hover:text-ink">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-4 space-y-5">
          {GROUPS.map((group) => {
            const routes = ALL_ROUTES.filter((r) => r.group === group && allowedHrefs.includes(r.href));
            if (routes.length === 0) return null;
            return (
              <div key={group}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink/60">{group}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {routes.map((route) => {
                    const { Icon } = route;
                    const active = selected.includes(route.href);
                    const disabled = !active && selected.length >= MAX_LINKS;
                    return (
                      <button
                        key={route.href}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(route.href)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-[8px] border px-3 py-2 text-[12px] font-medium transition-all duration-100 text-left",
                          active
                            ? "border-brand/40 bg-brand/8 text-brand"
                            : disabled
                            ? "border-line bg-muted/40 text-ink/30 cursor-not-allowed"
                            : "border-line bg-surface text-ink/70 hover:bg-muted hover:text-ink"
                        )}
                      >
                        <Icon size={13} strokeWidth={1.8} className="shrink-0" />
                        <span className="truncate">{route.label}</span>
                        {active && (
                          <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand text-white text-[9px] font-bold">
                            {selected.indexOf(route.href) + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-line px-3 py-1.5 text-[12px] font-medium text-ink/60 hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(selected)}
            className="rounded-[8px] bg-brand px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-brand/90 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export function QuickLinks({ initialLinks, allowedHrefs }: { initialLinks: string[]; allowedHrefs: string[] }) {
  const [links, setLinks] = useState<string[]>(initialLinks);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const routes = links
    .map((href) => ALL_ROUTES.find((r) => r.href === href))
    .filter(Boolean) as RouteItem[];

  function handleSave(hrefs: string[]) {
    setLinks(hrefs);
    setEditing(false);
    startTransition(async () => {
      await saveQuickLinksAction(hrefs);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {routes.map((route) => (
            <QuickLinkCard key={route.href} route={route} />
          ))}
          {routes.length === 0 && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-line bg-surface p-3 text-ink/60 transition-colors hover:border-brand/40 hover:text-brand min-w-[80px]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-muted">
                <Plus size={16} />
              </span>
              <span className="text-[11px] font-semibold leading-tight">Adicionar</span>
            </button>
          )}
        </div>
        {routes.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Editar atalhos"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-line text-ink/35 transition-colors hover:bg-muted hover:text-ink"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>

      {editing && (
        <EditModal
          current={links}
          allowedHrefs={allowedHrefs}
          onClose={() => setEditing(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
