"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { CategoriaFinanceira } from "@/lib/data/lancamentos";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  categorias: CategoriaFinanceira[];
  submitLabel: string;
};

export function ContratoForm({ action, categorias, submitLabel }: Props) {
  const [valor, setValor] = useState<number>(0);
  const receitas = categorias.filter((c) => c.tipo === "receita");

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <label className="md:col-span-2">
        Descrição
        <input name="descricao" required maxLength={200} placeholder="Ex.: Terceirização lanchonete" />
      </label>
      <label>
        Contraparte
        <input name="contraparte" maxLength={200} placeholder="Ex.: Lanchonete do Zé" />
      </label>
      <label>
        Categoria
        <select name="categoria_id" defaultValue="">
          <option value="">—</option>
          {receitas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      <label>
        Valor mensal
        <CurrencyInput name="valor" value={valor} onChange={setValor} required />
      </label>
      <label>
        Dia de vencimento (1–28)
        <input type="number" name="dia_vencimento" min="1" max="28" required defaultValue="10" />
      </label>
      <label>
        Início
        <input type="date" name="inicio" required />
      </label>
      <label>
        Fim (opcional)
        <input type="date" name="fim" />
      </label>
      <label className="flex items-center gap-2 pb-3">
        <input type="checkbox" name="ativo" defaultChecked className="h-4 w-4" /> Ativo
      </label>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
