import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "danger" | "success";

const TONES: Record<Tone, { icon: typeof Info; classes: string; iconClasses: string }> = {
  info: {
    icon: Info,
    classes: "border-brand/25 bg-brand/[0.06] text-ink",
    iconClasses: "text-brand",
  },
  warning: {
    icon: AlertTriangle,
    classes: "border-warning/30 bg-warning/[0.08] text-ink",
    iconClasses: "text-warning",
  },
  danger: {
    icon: XCircle,
    classes: "border-danger/30 bg-danger/[0.08] text-ink",
    iconClasses: "text-danger",
  },
  success: {
    icon: CheckCircle2,
    classes: "border-success/30 bg-success/[0.08] text-ink",
    iconClasses: "text-success",
  },
};

type Props = {
  tone?: Tone;
  /** Título curto em negrito. Omitir quando o corpo já é autoexplicativo. */
  title?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Aviso persistente de página: lista de pendências, restrição de dados, aviso
 * de regra de negócio — qualquer coisa que fique visível enquanto a condição
 * existir (não é feedback de ação, isso é toast via useAction).
 *
 * Difere de FieldNote (nota pequena abaixo de um campo, sem fundo/borda) e de
 * StatusBanner (mensagem de redirect com auto-dismiss e sem título).
 */
export function PageNotice({ tone = "info", title, children, className }: Props) {
  const { icon: Icon, classes, iconClasses } = TONES[tone];

  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-ui border px-4 py-3 text-sm leading-relaxed",
        classes,
        className
      )}
    >
      <Icon size={18} className={cn("mt-0.5 shrink-0", iconClasses)} aria-hidden />
      <div className="min-w-0 grid gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-ink/75">{children}</div>
      </div>
    </div>
  );
}
