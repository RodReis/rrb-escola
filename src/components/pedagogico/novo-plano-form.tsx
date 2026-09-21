"use client";

import { Plus } from "lucide-react";
import { createPlanAction } from "@/lib/actions/academics";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";

// createPlanAction e contrato C (void+revalidatePath no sucesso) — toast ja
// funciona sem migrar a action.
export function NovoPlanoForm() {
  const { run, pending } = useAction(createPlanAction, {
    success: "Plano adicionado.",
    error: "Falha ao adicionar o plano.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-6">
      <label className="md:col-span-2">
        Nome
        <input name="nome" required />
      </label>
      <label>
        Matricula
        <input name="valor_matricula" inputMode="decimal" />
      </label>
      <label>
        Mensalidade
        <input name="valor_mensalidade" inputMode="decimal" />
      </label>
      <label>
        Parcelas
        <input name="quantidade_parcelas" type="number" defaultValue={12} />
      </label>
      <label>
        Vencimento
        <input name="dia_vencimento" type="number" defaultValue={10} />
      </label>
      <label className="md:col-span-5">
        Descrição
        <input name="descricao" />
      </label>
      <Button type="submit" loading={pending} className="self-end">
        <Plus size={14} /> Adicionar
      </Button>
    </form>
  );
}
