import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

export function StatusPill({
  tone = "neutral",
  children,
  sub,
  className
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      <span
        className={cn(
          "ds-status",
          tone === "success" && "ds-status-success",
          tone === "warning" && "ds-status-warning",
          tone === "danger" && "ds-status-danger",
          tone === "neutral" && "ds-status-neutral"
        )}
      >
        {children}
      </span>
      {sub ? <span className="pl-3.5 text-[0.72rem] font-medium text-ink/50">{sub}</span> : null}
    </span>
  );
}
