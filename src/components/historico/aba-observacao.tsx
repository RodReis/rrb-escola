"use client";

import { salvarObservacaoAction } from "@/lib/actions/historico";
import type { HistoricoData, NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  alunoId: string;
  nivel: NivelEnsino;
  historico: HistoricoData | null;
};

export function AbaObservacao({ alunoId, nivel, historico }: Props) {
  return (
    <form action={salvarObservacaoAction} className="space-y-4 rounded-lg border border-line p-4">
      <input type="hidden" name="alunoId" value={alunoId} />
      <input type="hidden" name="nivel" value={nivel} />
      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          rows={10}
          defaultValue={historico?.observacoes ?? ""}
          className="rounded border border-line bg-surface p-2"
        />
      </label>
      <button type="submit" className="rounded bg-brand px-4 py-2 text-paper">
        Gravar
      </button>
    </form>
  );
}
