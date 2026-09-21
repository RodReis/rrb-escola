"use client";

import { Plus } from "lucide-react";
import { createSerieAction } from "@/lib/actions/academics";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";

// createSerieAction e contrato C (void+revalidatePath no sucesso) — toast
// ja funciona sem migrar a action.
export function NovaSerieForm() {
  const { run, pending } = useAction(createSerieAction, {
    success: "Série adicionada.",
    error: "Falha ao adicionar a série.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_160px_150px]">
      <label>
        Nome
        <input name="nome" placeholder="6 Ano" required />
      </label>
      <label>
        Ordem
        <input name="ordem" type="number" defaultValue={1} />
      </label>
      <Button type="submit" loading={pending} className="self-end">
        <Plus size={14} /> Adicionar
      </Button>
    </form>
  );
}
