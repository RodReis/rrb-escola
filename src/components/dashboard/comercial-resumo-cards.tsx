import Link from "next/link";
import { ShoppingBag, Receipt, Boxes, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { money } from "@/lib/constants";
import type { ComercialResumo } from "@/lib/data/dashboard-comercial";

// Hue do DS por card (mesmo tratamento dos KPI cards da aba Financeiro:
// tinta de fundo, chip de ícone colorido e valor grande tabular).
type Hue = "green" | "blue" | "violet" | "coral";

const HUE: Record<Hue, string> = {
  green: "var(--c-green)",
  blue: "var(--c-blue)",
  violet: "var(--c-violet)",
  coral: "var(--c-coral)",
};

// Painel de KPIs comerciais do dashboard: receita de vendas, vendas
// confirmadas, valor imobilizado em estoque e alertas de reposição.
export function ComercialResumoCards({ data }: { data: ComercialResumo }) {
  const cards: Array<{ label: string; value: string; hint: string; Icon: LucideIcon; hue: Hue; href: string }> = [
    {
      label: "Receita de vendas",
      value: money.format(data.receitaVendas),
      hint: "pagas no mês",
      Icon: Receipt,
      hue: "green",
      href: "/comercial/vendas",
    },
    {
      label: "Vendas confirmadas",
      value: data.vendasConfirmadas.toLocaleString("pt-BR"),
      hint: "no mês",
      Icon: ShoppingBag,
      hue: "blue",
      href: "/comercial/vendas",
    },
    {
      label: "Imobilizado",
      value: money.format(data.imobilizado),
      hint: "saldo × custo",
      Icon: Boxes,
      hue: "violet",
      href: "/comercial/estoque",
    },
    {
      label: "Reposição",
      value: data.alertasReposicao.toLocaleString("pt-BR"),
      hint: "tamanhos acabando",
      Icon: AlertTriangle,
      hue: data.alertasReposicao > 0 ? "coral" : "green",
      href: "/comercial/estoque",
    },
  ];

  return (
    <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const hue = HUE[c.hue];
        return (
          <Link key={c.label} href={c.href} className="group">
            <article
              className="h-full rounded-panel border bg-surface p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              style={{
                borderColor: `color-mix(in oklab, ${hue} var(--tint-border), var(--border))`,
                backgroundImage: `linear-gradient(165deg, color-mix(in oklab, ${hue} calc(var(--tint-strength) + 4%), var(--surface)), var(--surface) 78%)`,
              }}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-ui text-white"
                style={{ background: hue, boxShadow: `0 6px 14px -6px ${hue}` }}
              >
                <c.Icon size={16} />
              </span>
              <div className="mt-3 text-[0.66rem] font-semibold uppercase tracking-kicker" style={{ color: "var(--text-muted)" }}>
                {c.label}
              </div>
              <div className="mt-1 font-display text-3xl font-bold tabular-nums leading-none text-ink">{c.value}</div>
              <div className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>{c.hint}</div>
            </article>
          </Link>
        );
      })}
    </section>
  );
}
