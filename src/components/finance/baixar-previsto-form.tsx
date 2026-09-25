"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/constants";
import { baixarPrevistoAction } from "@/lib/actions/debitos";
import { useAction } from "@/lib/hooks/use-action";
import type { PrevistoBasico } from "@/lib/data/debitos";

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

/** Escolha do título a baixar. Com um candidato só, já vem marcado. */
export function BaixarPrevistoForm({
  extratoId,
  candidatos,
}: {
  extratoId: string;
  candidatos: PrevistoBasico[];
}) {
  const [escolhido, setEscolhido] = useState<string>(candidatos.length === 1 ? candidatos[0].id : "");
  const { run, pending } = useAction((formData: FormData) => baixarPrevistoAction(formData), {
    success: "Título baixado.",
    confirm: "Baixar este título com o débito do extrato?",
  });

  return (
    <form action={(formData) => run(formData)} className="grid gap-2">
      <input type="hidden" name="extrato_id" value={extratoId} />
      <div className="grid gap-1">
        {candidatos.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-xs text-ink/70">
            <input
              type="radio"
              name="lancamento_id"
              value={c.id}
              checked={escolhido === c.id}
              onChange={() => setEscolhido(c.id)}
            />
            <span>
              {c.descricao} — <span className="tabular-nums">{money.format(c.valor)}</span>, vence {dateText(c.dataVencimento)}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="text-xs" loading={pending} disabled={!escolhido}>
          Baixar título
        </Button>
      </div>
    </form>
  );
}
