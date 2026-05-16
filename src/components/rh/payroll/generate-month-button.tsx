"use client";

import { Plus, RefreshCcw } from "lucide-react";
import { generateMonthAction, syncNewEmployeesAction } from "@/lib/actions/payroll";

export function GenerateMonthButton({ mes, hasPayrolls }: { mes: string; hasPayrolls: boolean }) {
  if (hasPayrolls) {
    return (
      <form
        action={syncNewEmployeesAction}
        onSubmit={(e) => {
          if (!confirm(`Adicionar novos funcionários ativos sem lançamento no mês ${mes}?`)) {
            e.preventDefault();
          }
        }}
        className="inline"
      >
        <input type="hidden" name="mes" value={mes} />
        <button type="submit" className="ds-button ds-button-secondary">
          <RefreshCcw size={14} /> Adicionar novos
        </button>
      </form>
    );
  }
  return (
    <form
      action={generateMonthAction}
      onSubmit={(e) => {
        if (!confirm(`Gerar folha de ${mes}? Linhas serão criadas copiando base_salary do mês anterior.`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="mes" value={mes} />
      <button type="submit" className="ds-button ds-button-primary">
        <Plus size={14} /> Gerar folha do mês
      </button>
    </form>
  );
}
