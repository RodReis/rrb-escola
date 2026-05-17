"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FORMAS_PAGAMENTO } from "@/lib/validation/despesas";
import type { CategoriaDespesa, DespesaRow } from "@/lib/data/despesas";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  categorias: CategoriaDespesa[];
  initial?: Partial<DespesaRow>;
  submitLabel: string;
};

export function DespesaForm({ action, categorias, initial, submitLabel }: Props) {
  const [valor, setValor] = useState<number>(initial?.valor ?? 0);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <label className="md:col-span-2">
        Descrição
        <input
          name="descricao"
          required
          maxLength={200}
          defaultValue={initial?.descricao ?? ""}
          placeholder="Ex.: Conta de luz - abril"
        />
      </label>

      <label>
        Categoria
        <select name="categoria_id" required defaultValue={initial?.categoria_id ?? ""}>
          <option value="">Selecione...</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>

      <label>
        Fornecedor
        <input
          name="fornecedor"
          maxLength={200}
          defaultValue={initial?.fornecedor ?? ""}
          placeholder="Ex.: CPFL Energia"
        />
      </label>

      <label>
        Valor
        <CurrencyInput name="valor" value={valor} onChange={setValor} required />
      </label>

      <label>
        Vencimento
        <input
          type="date"
          name="data_vencimento"
          required
          defaultValue={initial?.data_vencimento ?? ""}
        />
      </label>

      <label>
        Data pagamento
        <input
          type="date"
          name="data_pagamento"
          defaultValue={initial?.data_pagamento ?? ""}
        />
      </label>

      <label>
        Forma pagamento
        <select name="forma_pagamento" defaultValue={initial?.forma_pagamento ?? ""}>
          <option value="">—</option>
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </label>

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
