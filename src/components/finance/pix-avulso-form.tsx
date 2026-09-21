"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { gerarPixCobrancaFormAction } from "@/lib/actions/sicoob";
import type { GerarPixResult } from "@/lib/actions/sicoob";

type Conta = {
  id: string;
  apelido: string | null;
  conta: string;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending || disabled}>
      {pending ? "Gerando…" : "Gerar Pix"}
    </Button>
  );
}

export function PixAvulsoForm({ contas }: { contas: Conta[] }) {
  const [valor, setValor] = useState<number>(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<GerarPixResult | null, FormData>(
    gerarPixCobrancaFormAction,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Pix gerado.");
      formRef.current?.reset();
      setValor(0);
    } else {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <div className="grid gap-3">
      <form
        ref={formRef}
        action={formAction}
        className="grid gap-4 md:grid-cols-[1fr_1.4fr_180px_auto] md:items-end"
      >
        <label>
          Conta
          <select name="conta_id" required>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.apelido ?? conta.conta}
              </option>
            ))}
          </select>
        </label>

        <label>
          Descrição
          <input name="descricao" required maxLength={140} placeholder="Ex.: Taxa de uniforme" />
        </label>

        <label>
          Valor
          <CurrencyInput name="valor" value={valor} onChange={setValor} required />
        </label>

        <SubmitButton disabled={valor <= 0} />
      </form>

      {state?.ok ? (
        <div className="grid gap-2 rounded-ui border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-kicker text-ink/60">Copia e cola</p>
          <code className="break-all text-xs text-ink">{state.copiaCola}</code>
        </div>
      ) : null}
    </div>
  );
}
