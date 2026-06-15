"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FORMAS_PAGAMENTO, type TipoLancamento } from "@/lib/validation/lancamentos";
import type { CategoriaFinanceira, LancamentoRow } from "@/lib/data/lancamentos";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  categorias: CategoriaFinanceira[];
  initial?: Partial<LancamentoRow>;
  submitLabel: string;
};

export function LancamentoForm({ action, categorias, initial, submitLabel }: Props) {
  const [valor, setValor] = useState<number>(initial?.valor ?? 0);
  const [tipo, setTipo] = useState<TipoLancamento>(initial?.tipo ?? "despesa");

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <label>
        Tipo
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoLancamento)}
        >
          <option value="despesa">Despesa (saída)</option>
          <option value="receita">Receita (entrada)</option>
        </select>
      </label>

      {tipo === "despesa" ? (
        <label>
          Classe
          <select name="classe_despesa" defaultValue={initial?.classe_despesa ?? "variavel"}>
            <option value="variavel">Variável (pontual)</option>
            <option value="fixa">Fixa (todo mês)</option>
          </select>
        </label>
      ) : (
        <div className="hidden md:block" />
      )}

      <label className="md:col-span-2">
        Descrição
        <input
          name="descricao"
          required
          maxLength={200}
          defaultValue={initial?.descricao ?? ""}
          placeholder={tipo === "receita" ? "Ex.: Venda de uniformes - feira" : "Ex.: Conta de luz - abril"}
        />
      </label>

      <label>
        Categoria
        <select name="categoria_id" required defaultValue={initial?.categoria_id ?? ""}>
          <option value="">Selecione...</option>
          {categoriasDoTipo.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>

      <label>
        {tipo === "receita" ? "Cliente" : "Fornecedor"}
        <input
          name="contraparte"
          maxLength={200}
          defaultValue={initial?.contraparte ?? ""}
          placeholder={tipo === "receita" ? "Ex.: João da Silva" : "Ex.: CPFL Energia"}
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
