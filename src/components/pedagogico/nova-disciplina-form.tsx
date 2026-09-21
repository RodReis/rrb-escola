"use client";

import { createDisciplinaAction } from "@/lib/actions/disciplinas";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";

type Serie = { id: string; nome: string };

// createDisciplinaAction e contrato C (throw no erro, void+revalidatePath no
// sucesso) — toast ja funciona sem migrar a action.
export function NovaDisciplinaForm({ series }: { series: Serie[] }) {
  const { run, pending } = useAction(createDisciplinaAction, {
    success: "Disciplina adicionada.",
    error: "Falha ao adicionar a disciplina.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-4">
      <label>
        Série
        <select name="serie_id" required>
          <option value="">Selecione...</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </label>
      <label className="md:col-span-2">
        Nome
        <input name="nome" required maxLength={80} placeholder="Ex.: Matemática" />
      </label>
      <label>
        Ordem
        <input name="ordem" type="number" defaultValue={0} />
      </label>
      <div className="md:col-span-4 flex justify-end">
        <Button type="submit" loading={pending} className="px-4">
          Adicionar
        </Button>
      </div>
    </form>
  );
}
