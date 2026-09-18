import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { wrap: "text-muted", icon: "text-muted" },
  warn: { wrap: "text-gold", icon: "text-gold" },
};

export function FieldNote({
  children,
  tone = "info",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  const Icon = tone === "warn" ? AlertTriangle : Info;
  return (
    <span className={cn("mt-1 flex items-start gap-1.5 text-xs font-medium leading-snug", tones[tone].wrap, className)}>
      <Icon size={13} className={cn("mt-px shrink-0", tones[tone].icon)} aria-hidden />
      <span className="min-w-0">{children}</span>
    </span>
  );
}
