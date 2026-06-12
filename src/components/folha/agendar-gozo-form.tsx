"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { agendarGozoAction } from "@/lib/actions/folha-especiais";

type Props = {
  periodoId: string;
};

export function AgendarGozoForm({ periodoId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(() => {
      agendarGozoAction(data);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
      <input type="hidden" name="periodo_id" value={periodoId} />
      <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
        Início do gozo
        <input name="gozo_inicio" type="date" required className="w-40" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
        Dias de gozo
        <input name="gozo_dias" type="number" min="5" max="30" step="5" defaultValue="30" required className="w-24" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
        Abono (dias)
        <select name="dias_abono" className="w-24">
          <option value="0">0</option>
          <option value="10">10</option>
        </select>
      </label>
      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? "Agendando…" : "Agendar gozo"}
      </Button>
    </form>
  );
}
