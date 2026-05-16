import { Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import type { MonthSummary } from "@/lib/data/payroll";

export function PayrollSummaryCard({ summary }: { summary: MonthSummary }) {
  const items: Array<{ label: string; value: string; tone?: "success" | "danger" | "warning" }> = [
    { label: "Funcionários", value: summary.count.toLocaleString("pt-BR") },
    { label: "Proventos",    value: money.format(summary.total_proventos), tone: "success" },
    { label: "INSS",         value: money.format(summary.total_inss), tone: "danger" },
    { label: "IR",           value: money.format(summary.total_ir), tone: "danger" },
    { label: "Descontos",    value: money.format(summary.total_descontos), tone: "warning" },
    { label: "Líquido",      value: money.format(summary.total_liquido), tone: "success" }
  ];
  return (
    <Panel className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 p-4">
      {items.map((it) => (
        <div key={it.label}>
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.10em] text-ink/55">{it.label}</p>
          <strong
            className={`mt-1 block text-lg font-bold tabular-nums ${
              it.tone === "success" ? "text-success" : it.tone === "danger" ? "text-danger" : it.tone === "warning" ? "text-warning" : "text-ink"
            }`}
          >
            {it.value}
          </strong>
        </div>
      ))}
    </Panel>
  );
}
