"use client";

import { Plus } from "lucide-react";
import { createTurmaAction } from "@/lib/actions/academics";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";

type Serie = { id: string; nome: string };

export function NovaTurmaForm({ series, currentYear }: { series: Serie[]; currentYear: number }) {
  const { run, pending } = useAction(createTurmaAction, {
    success: "Turma adicionada.",
    error: "Falha ao adicionar a turma.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-6">
      <label>
        Serie
        <select name="serie_id" required>
          {series.map((item) => (
            <option key={item.id} value={item.id}>{item.nome}</option>
          ))}
        </select>
      </label>
      <label>
        Nome
        <input name="nome" placeholder="A" required />
      </label>
      <label>
        Ano letivo
        <input name="ano_letivo" type="number" defaultValue={currentYear} />
      </label>
      <label>
        Turno
        <select name="turno">
          <option value="matutino">Matutino</option>
          <option value="vespertino">Vespertino</option>
          <option value="noturno">Noturno</option>
          <option value="integral">Integral</option>
        </select>
      </label>
      <label>
        Capacidade
        <input name="capacidade" type="number" defaultValue={30} />
      </label>
      <Button type="submit" loading={pending} className="self-end">
        <Plus size={14} /> Adicionar
      </Button>
    </form>
  );
}
