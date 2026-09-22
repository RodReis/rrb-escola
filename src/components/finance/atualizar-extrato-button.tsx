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
      // Conta que falhou não derruba as outras, mas não pode passar calada:
      // com dois CNPJs, um certificado vencido deixaria aquele banco sem
      // extrato enquanto a tela dizia "atualizado".
      if (state.falhas.length > 0) {
        toast.error(`${state.falhas.length} conta(s) não sincronizaram: ${state.falhas.join(" | ")}`, {
          duration: 12000,
        });
      }
      if (state.repassesCasados > 0) {
        toast.success(`${state.repassesCasados} transferência(s) do repasse isaac conciliada(s).`);
      }
      if (state.movimentos === 0 && state.descartados > 0) {
        toast.warning(
          `${state.descartados} movimento(s) ignorado(s) por virem sem valor numérico. Em sandbox o Sicoob devolve dados fictícios.`,
        );
      } else if (state.falhas.length === 0) {
        toast.success(
          state.movimentos > 0
            ? `Extrato atualizado: ${state.movimentos} movimento(s).`
            : "Extrato atualizado. Nenhum movimento novo.",
        );
      }
    } else {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <SubmitButton />
    </form>
  );
}
