import Link from "next/link";
import { ShoppingBag, Receipt, Boxes, AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import type { ComercialResumo } from "@/lib/data/dashboard-comercial";

// Painel de KPIs comerciais do dashboard: receita de vendas, vendas
// confirmadas, valor imobilizado em estoque e alertas de reposição.
export function ComercialResumoCards({ data }: { data: ComercialResumo }) {
  const cards = [
    {
      label: "Receita de vendas",
      value: money.format(data.receitaVendas),
      hint: "pagas no mês",
      Icon: Receipt,
      tone: "text-success",
      href: "/comercial/vendas",
    },
    {
      label: "Vendas confirmadas",
      value: data.vendasConfirmadas.toLocaleString("pt-BR"),
      hint: "no mês",
      Icon: ShoppingBag,
      tone: "text-brand",
      href: "/comercial/vendas",
    },
    {
      label: "Imobilizado",
      value: money.format(data.imobilizado),
      hint: "saldo × custo",
      Icon: Boxes,
      tone: "text-ink",
      href: "/comercial/estoque",
    },
    {
      label: "Reposição",
      value: data.alertasReposicao.toLocaleString("pt-BR"),
      hint: "tamanhos acabando",
      Icon: AlertTriangle,
      tone: data.alertasReposicao > 0 ? "text-danger" : "text-success",
      href: "/comercial/estoque",
    },
  ];

  return (
    <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.label} href={c.href} className="group">
          <Panel className="p-5 transition hover:border-brand/40 hover:shadow-lift">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
              <c.Icon size={14} className={c.tone} />
              {c.label}
            </div>
            <div className={`text-2xl font-bold tabular-nums ${c.tone}`}>{c.value}</div>
            <div className="mt-1 text-xs text-ink/45">{c.hint}</div>
          </Panel>
        </Link>
      ))}
    </section>
  );
}
