"use client";

import { Button } from "@/components/ui/button";
import { createCategoriaFinanceiraAction } from "@/lib/actions/categorias-financeiras";

export function CategoriaFinanceiraCreateForm() {
  return (
    <form
      action={createCategoriaFinanceiraAction}
      className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto] items-end"
    >
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
      <Button type="submit" variant="primary">Adicionar</Button>
    </form>
  );
}
