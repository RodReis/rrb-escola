"use client";

import { Button } from "@/components/ui/button";
import { createCategoriaAction } from "@/lib/actions/categorias-despesa";

export function CategoriaCreateForm() {
  return (
    <form action={createCategoriaAction} className="grid gap-4 md:grid-cols-[1fr_auto_auto] items-end">
      <label>
        Nome
        <input name="nome" required maxLength={80} placeholder="Ex.: Telefone" />
      </label>
      <label className="flex items-center gap-2 pb-3">
        <input type="checkbox" name="ativo" defaultChecked className="h-4 w-4" />
        Ativa
      </label>
      <Button type="submit" variant="primary">Adicionar</Button>
    </form>
  );
}
