import { Badge } from "@/components/ui/badge";
import type { StatusFinanceiroMes } from "@/lib/finance/status-mes-corrente";

const LABEL: Record<Exclude<StatusFinanceiroMes, null>, string> = {
  pago_isaac: "Pago (isaac)",
  pago_manual: "Pago (manual)",
  aberto: "Em aberto",
  vencido: "Vencido",
};

const TONE: Record<Exclude<StatusFinanceiroMes, null>, "green" | "gray" | "gold" | "red"> = {
  pago_isaac: "green",
  pago_manual: "green",
  aberto: "gray",
  vencido: "red",
};

export function FinanceiroStatusBadge({ status }: { status: StatusFinanceiroMes }) {
  if (status === null) return <span className="text-ink/38">—</span>;
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
