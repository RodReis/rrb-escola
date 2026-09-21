// Helpers puros de agregação dos indicadores de pipeline.
// Separado da action ("use server") porque exports de módulo server precisam ser async.

import { STATUS_LEAD, type StatusLead } from "@/lib/validation/pipeline";

// Agrupa cards por status_lead, garantindo os 5 status na ordem do enum (zera ausentes).
export function agruparPorStatus(
  rows: { status_lead?: string | null }[],
): { status: StatusLead; total: number }[] {
  const contagem: Record<string, number> = {};
  for (const row of rows) {
    const s = row.status_lead;
    if (!s) continue;
    contagem[s] = (contagem[s] ?? 0) + 1;
  }
  return STATUS_LEAD.map((status) => ({ status, total: contagem[status] ?? 0 }));
}
