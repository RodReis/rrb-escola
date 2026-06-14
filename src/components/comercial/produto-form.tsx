"use client";

import { TIPOS_PRODUTO } from "@/lib/validation/comercial";
import { Button } from "@/components/ui/button";
import type { ProdutoRow } from "@/lib/data/comercial";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Partial<ProdutoRow>;
  submitLabel: string;
};

export function ProdutoForm({ action, initial, submitLabel }: Props) {
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <label className="md:col-span-2">
        Nome
        <input name="nome" required maxLength={120} defaultValue={initial?.nome ?? ""} placeholder="Ex.: Camiseta do uniforme" />
      </label>

      <label>
        Tipo
        <select name="tipo" defaultValue={initial?.tipo ?? "uniforme"}>
          {TIPOS_PRODUTO.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 pb-3">
        <input type="checkbox" name="controla_estoque" defaultChecked={initial?.controla_estoque ?? false} className="h-4 w-4" />
        Controla estoque (uniforme = sim; apostila = não)
      </label>

      <label className="flex items-center gap-2 pb-3">
        <input type="checkbox" name="ativo" defaultChecked={initial?.ativo ?? true} className="h-4 w-4" />
        Ativo
      </label>

      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
