"use client";

import { useRef } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { generateMonthAction, syncNewEmployeesAction } from "@/lib/actions/payroll";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function GenerateMonthButton({ mes, hasPayrolls }: { mes: string; hasPayrolls: boolean }) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);

  if (hasPayrolls) {
    return (
      <form ref={formRef} action={syncNewEmployeesAction} className="inline">
        <input type="hidden" name="mes" value={mes} />
        <button
          type="button"
          className="ds-button ds-button-secondary"
          onClick={async () => {
            const ok = await confirm({
              title: "Adicionar funcionários",
              message: `Adicionar novos funcionários ativos sem lançamento no mês ${mes}?`,
              confirmLabel: "Adicionar",
              variant: "default",
            });
            if (ok) formRef.current?.requestSubmit();
          }}
        >
          <RefreshCcw size={14} /> Adicionar novos
        </button>
      </form>
    );
  }

  return (
    <form ref={formRef} action={generateMonthAction} className="inline">
      <input type="hidden" name="mes" value={mes} />
      <button
        type="button"
        className="ds-button ds-button-primary"
        onClick={async () => {
          const ok = await confirm({
            title: "Gerar folha",
            message: `Gerar folha de ${mes}? Linhas serão criadas copiando base_salary do mês anterior.`,
            confirmLabel: "Gerar folha",
            variant: "default",
          });
          if (ok) formRef.current?.requestSubmit();
        }}
      >
        <Plus size={14} /> Gerar folha do mês
      </button>
    </form>
  );
}
