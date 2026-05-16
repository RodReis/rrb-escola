import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DataTableShell({
  toolbar,
  children,
  footer,
  className
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-panel border border-line bg-surface shadow-soft", className)}>
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">{toolbar}</div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
      {footer ? <div className="ds-dt-foot">{footer}</div> : null}
    </section>
  );
}
