import { cn } from "@/lib/utils";

/**
 * Usa o token `sp` do Design System (DESIGN-SYSTEM.md:703).
 * `currentColor` faz o spinner herdar a cor do botao que o contem,
 * para funcionar em qualquer variante (primary, danger, ghost).
 */
export function Spinner({
  size = 13,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      data-testid="spinner"
      aria-hidden="true"
      className={cn("ds-spinner inline-block flex-shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
