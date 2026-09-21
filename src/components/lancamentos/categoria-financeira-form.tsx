"use client";

import { Button } from "@/components/ui/button";
import { createCategoriaFinanceiraAction } from "@/lib/actions/categorias-financeiras";
import { useAction } from "@/lib/hooks/use-action";

export function CategoriaFinanceiraCreateForm() {
  const { run, pending } = useAction(createCategoriaFinanceiraAction, {
    success: "Categoria adicionada.",
    error: "Falha ao adicionar a categoria.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto] items-end">
      <label>
        Nome
        <input name="nome" required maxLength={80} placeholder="Ex.: Venda de uniformes" />
      </label>
      <label>
        Tipo
        <select name="tipo" defaultValue="despesa">
          <option value="despesa">Despesa</option>
          <option value="receita">Receita</option>
        </select>
      </label>
      <label className="flex items-center gap-2 pb-3">
        <input type="checkbox" name="ativo" defaultChecked className="h-4 w-4" />
        Ativa
      </label>
      <Button type="submit" variant="primary" loading={pending}>Adicionar</Button>
    </form>
  );
}
