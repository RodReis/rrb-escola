"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { atualizarExtratoAction, type AtualizarExtratoResult } from "@/lib/actions/conciliacao";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button variant="secondary" disabled={pending}>
      <RefreshCcw size={14} /> {pending ? "Atualizando…" : "Atualizar extrato"}
    </Button>
  );
}

export function AtualizarExtratoButton() {
  const [state, formAction] = useFormState<AtualizarExtratoResult | null, FormData>(
    atualizarExtratoAction,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(
        state.movimentos > 0
          ? `Extrato atualizado: ${state.movimentos} movimento(s).`
          : "Extrato atualizado. Nenhum movimento novo.",
      );
    } else {
      toast.error(state.reason);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <SubmitButton />
    </form>
  );
}
