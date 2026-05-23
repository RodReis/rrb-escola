import Link from "next/link";
import {
  BarChart3,
  CalendarCheck,
  CalendarHeart,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  Inbox,
  Layers3,
  LayoutDashboard,
  ReceiptText,
  School,
  ScrollText,
  UsersRound
} from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alunos", label: "Alunos", icon: UsersRound },
  { href: "/matriculas", label: "Matriculas", icon: FileText },
  { href: "/eventos", label: "Eventos", icon: CalendarHeart },
  { href: "/series", label: "Series", icon: Layers3 },
  { href: "/turmas", label: "Turmas", icon: GraduationCap },
  { href: "/planos", label: "Planos", icon: CreditCard },
  { href: "/financeiro", label: "Financeiro", icon: BarChart3 },
  { href: "/financeiro/folha", label: "Folha de Pgto.", icon: ScrollText },
  { href: "/portaria", label: "Portaria", icon: DoorOpen },
  { href: "/relatorios/alunos", label: "Rel. Alunos", icon: UsersRound },
  { href: "/relatorios/inadimplencia", label: "Inadimplência", icon: ReceiptText },
  { href: "/relatorios/frequencia", label: "Rel. Frequência", icon: CalendarCheck },
  { href: "/frequencias", label: "Frequência", icon: CalendarCheck },
  { href: "/importacoes", label: "Importações", icon: Inbox }
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-surface px-4 py-5 lg:block">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-ui bg-brand text-paper">
          <span className="absolute -right-2 top-0 h-14 w-8 rotate-[34deg] bg-accent" />
          <School className="relative z-10" size={22} />
        </span>
        <span>
          <strong className="block text-lg leading-none text-ink">Lectiva</strong>
          <small className="text-[0.68rem] font-black uppercase text-accent">RRB Escola</small>
        </span>
      </Link>
      <nav className="grid gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex h-11 items-center gap-3 rounded-ui px-3 text-sm font-bold text-ink transition hover:bg-muted"
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
