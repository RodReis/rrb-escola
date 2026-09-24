"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ignorarDebitoAction } from "@/lib/actions/debitos";
import { useAction } from "@/lib/hooks/use-action";

/** Ignorar exige motivo — sem isso o botão não confirma (regra da action). */
export function IgnorarDebitoForm({ extratoId }: { extratoId: string }) {
  const [motivo, setMotivo] = useState("");
  const { run, pending } = useAction((formData: FormData) => ignorarDebitoAction(formData), {
    success: "Movimento ignorado.",
  });

  return (
    <form
      action={(formData) => run(formData)}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="extrato_id" value={extratoId} />
      <input
        type="text"
        name="motivo"
        placeholder="Motivo para ignorar…"
        required
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="w-56 rounded-ui border border-line bg-surface px-2 py-1 text-xs"
      />
      <Button type="submit" variant="ghost" className="text-xs" loading={pending} disabled={!motivo.trim()}>
        Ignorar
      </Button>
    </form>
  );
}
