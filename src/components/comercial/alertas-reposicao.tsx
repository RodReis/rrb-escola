"use client";

import { AlertTriangle, PackageX, TriangleAlert } from "lucide-react";
import type { SaldoVariacaoRow } from "@/lib/data/estoque";

function attrText(attrs: Record<string, string>) {
  const s = Object.values(attrs).filter(Boolean).join(" · ");
  return s || null;
}

// Alertas de reposição com hierarquia de urgência:
// - crítico: saldo 0 (vermelho sólido, ícone pulsa)
// - baixo: saldo > 0 mas <= mínimo (âmbar)
// Entrada com stagger; respeita prefers-reduced-motion (motion-safe/-reduce).
export function AlertasReposicao({ alertas }: { alertas: SaldoVariacaoRow[] }) {
  if (alertas.length === 0) return null;

  const criticos = alertas.filter((a) => a.saldo <= 0);
  const baixos = alertas.filter((a) => a.saldo > 0);
  const ordenados = [...criticos, ...baixos];

  return (
    <section
      aria-label={`${alertas.length} variações precisando de reposição`}
      className="overflow-hidden rounded-ui border border-danger/30 bg-gradient-to-br from-danger/[0.06] to-warning/[0.05] p-5 motion-safe:animate-fade-in-up"
    >
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-danger">
        <AlertTriangle size={13} className="motion-safe:animate-pulse" />
        Tamanhos acabando
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white tabular-nums">
          {alertas.length}
        </span>
      </h2>

      <ul className="flex flex-wrap gap-2">
        {ordenados.map((a, i) => {
          const critico = a.saldo <= 0;
          const attrs = attrText(a.atributos);
          const Icon = critico ? PackageX : TriangleAlert;
          return (
            <li
              key={a.variacao_id}
              style={{ animationDelay: `${Math.min(i * 45, 360)}ms` }}
              className={[
                "group inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold",
                "motion-safe:animate-fade-in-up transition-transform duration-150 hover:-translate-y-0.5",
                critico
                  ? "bg-danger text-white shadow-sm"
                  : "border border-warning/40 bg-warning/10 text-warning",
              ].join(" ")}
            >
              <Icon size={13} strokeWidth={2.2} className={critico ? "motion-safe:animate-pulse" : ""} />
              <span className="font-bold">{a.produto_nome}</span>
              {a.sku ? <span className="opacity-80">{a.sku}</span> : null}
              {attrs ? <span className="opacity-70">· {attrs}</span> : null}
              <span
                className={[
                  "ml-1 rounded-full px-1.5 py-px tabular-nums",
                  critico ? "bg-white/20" : "bg-warning/15",
                ].join(" ")}
              >
                {critico ? "esgotado" : `resta ${a.saldo}`}
                <span className="opacity-70"> · mín {a.estoque_minimo}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
