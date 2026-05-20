"use client";

import { useRef } from "react";
import { Lock, Unlock } from "lucide-react";
import { closePeriodAction, reopenPeriodAction } from "@/lib/actions/payroll";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function ClosePeriodButton({ mes, status }: { mes: string; status: "aberto" | "fechado" }) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);

  if (status === "fechado") {
    return (
      <form ref={formRef} action={reopenPeriodAction} className="inline">
        <input type="hidden" name="mes" value={mes} />
        <button
          type="button"
          className="ds-button ds-button-secondary"
          onClick={async () => {
            const ok = await confirm({
              title: "Reabrir mês",
              message: `Reabrir o mês ${mes}? Edições voltarão a ser permitidas.`,
              confirmLabel: "Reabrir",
              variant: "warning",
            });
            if (ok) formRef.current?.requestSubmit();
          }}
        >
          <Unlock size={14} /> Reabrir mês
        </button>
      </form>
    );
  }

  return (
    <form ref={formRef} action={closePeriodAction} className="inline">
      <input type="hidden" name="mes" value={mes} />
      <button
        type="button"
        className="ds-button ds-button-secondary"
        onClick={async () => {
          const ok = await confirm({
            title: "Fechar mês",
            message: `Fechar o mês ${mes}? Edições serão bloqueadas até reabertura.`,
            confirmLabel: "Fechar mês",
            variant: "warning",
          });
          if (ok) formRef.current?.requestSubmit();
        }}
      >
        <Lock size={14} /> Fechar mês
      </button>
    </form>
  );
}
