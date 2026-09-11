import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = { label: string; href?: string };
export type KpiItem = {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
};

export function PageHeader({
  breadcrumb,
  title,
  counter,
  description,
  actions,
  kpis,
  className
}: {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  counter?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  kpis?: KpiItem[];
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-7", className)}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 ? (
            <nav className="ds-breadcrumb">
              {breadcrumb.map((item, i) => {
                const isLast = i === breadcrumb.length - 1;
                return (
                  <span key={i} className="inline-flex items-center gap-2">
                    {item.href && !isLast ? (
                      <Link href={item.href}>{item.label}</Link>
                    ) : (
                      <span className={isLast ? "current" : undefined}>{item.label}</span>
                    )}
                    {!isLast ? <span className="sep">/</span> : null}
                  </span>
                );
              })}
            </nav>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[26px] font-bold leading-tight text-ink">{title}</h1>
            {counter != null ? <span className="rb-pill rb-pill-info">{counter}</span> : null}
          </div>
          {description ? <p className="mt-1.5 text-[13.5px] text-ink/60">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">{actions}</div> : null}
      </div>

      {kpis && kpis.length > 0 ? (
        <dl className="ds-kpi-grid lg:flex lg:justify-end">
          {kpis.map((k, i) => (
            <div key={i} className="ds-kpi-cell">
              <dt className="ds-kpi-label">{k.label}</dt>
              <dd
                className={cn(
                  "ds-kpi-value",
                  k.tone === "success" && "ds-kpi-value-accent",
                  k.tone === "warning" && "ds-kpi-value-warn",
                  k.tone === "danger" && "ds-kpi-value-danger"
                )}
              >
                {k.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
