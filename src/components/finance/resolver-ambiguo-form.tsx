"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/constants";
import { resolverAmbiguoAction } from "@/lib/actions/debitos";
import { useAction } from "@/lib/hooks/use-action";
import type { MovimentoExtrato } from "@/lib/data/debitos";

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

/** Escolha manual de qual crédito candidato é o par certo do débito ambíguo (I2). */
export function ResolverAmbiguoForm({
  debitoId,
  candidatos,
}: {
  debitoId: string;
  candidatos: MovimentoExtrato[];
}) {
  const [creditoId, setCreditoId] = useState<string>("");
  const { run, pending } = useAction((formData: FormData) => resolverAmbiguoAction(formData), {
    success: "Par confirmado.",
    confirm: "Confirmar este crédito como o par do débito?",
  });

  return (
    <form action={(formData) => run(formData)} className="grid gap-2">
      <input type="hidden" name="debito_id" value={debitoId} />
      <p className="text-xs text-ink/60">Candidatos a crédito:</p>
      <div className="grid gap-1">
        {candidatos.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-xs text-ink/70">
            <input
              type="radio"
              name="credito_id"
              value={c.id}
              checked={creditoId === c.id}
              onChange={() => setCreditoId(c.id)}
            />
            <span className="tabular-nums">
              {dateText(c.data)} — {money.format(c.valor)}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="text-xs" loading={pending} disabled={!creditoId}>
          Confirmar par escolhido
        </Button>
      </div>
    </form>
  );
}
