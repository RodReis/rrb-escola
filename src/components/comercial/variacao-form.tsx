"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";

// Form de nova variação (SKU). Client por causa dos CurrencyInput (preço/custo
// com mascara R$). Submete via server action recebida por prop.
export function VariacaoForm({
  action,
  produtoId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  produtoId: string;
}) {
  const [preco, setPreco] = useState(0);
  const [custo, setCusto] = useState(0);

  return (
    <form action={action} className="grid gap-3 md:grid-cols-5 items-end">
      <input type="hidden" name="produto_id" value={produtoId} />
      <label>
        SKU
        <input name="sku" maxLength={60} placeholder="Ex.: CAM-M" />
      </label>
      <label>
        Preço
        <CurrencyInput name="preco_venda" value={preco} onChange={setPreco} required />
      </label>
      <label>
        Custo
        <CurrencyInput name="custo" value={custo} onChange={setCusto} />
      </label>
      <label>
        Estoque mín.
        <input type="number" name="estoque_minimo" step="1" min="0" defaultValue="0" />
      </label>
      <Button type="submit" variant="secondary">
        <Plus size={14} /> Adicionar
      </Button>
    </form>
  );
}
