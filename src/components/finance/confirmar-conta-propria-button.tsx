"use client";

import { Button } from "@/components/ui/button";
import { confirmarContaPropriaAction } from "@/lib/actions/debitos";
import { useAction } from "@/lib/hooks/use-action";

/** Débito para CNPJ próprio sem par de crédito casado (D2, ex.: Caixa) — confirma como transferência interna sem crédito de extrato. */
export function ConfirmarContaPropriaButton({ extratoId }: { extratoId: string }) {
  const { run, pending } = useAction((formData: FormData) => confirmarContaPropriaAction(formData), {
    success: "Transferência confirmada.",
    confirm: "Confirmar este débito como transferência para conta própria (sem extrato no sistema)?",
  });

  return (
    <form action={(formData) => run(formData)}>
      <input type="hidden" name="extrato_id" value={extratoId} />
      <Button type="submit" variant="secondary" className="text-xs" loading={pending}>
        Confirmar transferência
      </Button>
    </form>
  );
}
