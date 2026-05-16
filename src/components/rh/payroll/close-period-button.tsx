"use client";

import { Lock, Unlock } from "lucide-react";
import { closePeriodAction, reopenPeriodAction } from "@/lib/actions/payroll";

export function ClosePeriodButton({ mes, status }: { mes: string; status: "aberto" | "fechado" }) {
  if (status === "fechado") {
    return (
      <form
        action={reopenPeriodAction}
        onSubmit={(e) => {
          if (!confirm(`Reabrir o mês ${mes}? Edições voltarão a ser permitidas.`)) e.preventDefault();
        }}
        className="inline"
      >
        <input type="hidden" name="mes" value={mes} />
        <button type="submit" className="ds-button ds-button-secondary">
          <Unlock size={14} /> Reabrir mês
        </button>
      </form>
    );
  }
  return (
    <form
      action={closePeriodAction}
      onSubmit={(e) => {
        if (!confirm(`Fechar o mês ${mes}? Edições serão bloqueadas até reabertura.`)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="mes" value={mes} />
      <button type="submit" className="ds-button ds-button-secondary">
        <Lock size={14} /> Fechar mês
      </button>
    </form>
  );
}
