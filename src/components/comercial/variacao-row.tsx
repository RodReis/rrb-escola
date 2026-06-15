"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { updateVariacaoAction, deleteVariacaoAction } from "@/lib/actions/comercial";
import type { VariacaoRow } from "@/lib/data/comercial";

// Linha de variação sempre editável (edição direta na grid). Salvar (verde) e
// excluir (vermelho) sempre visíveis. CurrencyInput com mascara R$.
export function VariacaoRowItem({ v, produtoId }: { v: VariacaoRow; produtoId: string }) {
  const [preco, setPreco] = useState(v.preco_venda);
  const [custo, setCusto] = useState(v.custo);

  return (
    <tr className="border-t border-line">
      <td colSpan={6} className="p-0">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto_auto] items-end gap-2 px-2 py-2">
          <form action={updateVariacaoAction} className="contents">
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="produto_id" value={produtoId} />
            <label className="text-xs">
              SKU
              <input name="sku" defaultValue={v.sku ?? ""} maxLength={60} />
            </label>
            <label className="text-xs">
              Preço
              <CurrencyInput name="preco_venda" value={preco} onChange={setPreco} />
            </label>
            <label className="text-xs">
              Custo
              <CurrencyInput name="custo" value={custo} onChange={setCusto} />
            </label>
            <label className="text-xs">
              Est. mín.
              <input type="number" name="estoque_minimo" defaultValue={v.estoque_minimo} min="0" className="w-20" />
            </label>
            <label className="flex items-center gap-1 pb-2 text-xs">
              <input type="checkbox" name="ativo" defaultChecked={v.ativo} className="h-4 w-4" /> ativa
            </label>
            <Button
              type="submit"
              variant="primary"
              title="Salvar"
              aria-label="Salvar variação"
              className="!h-9 !w-9 !min-w-0 !px-0 bg-success hover:bg-success/90"
            >
              <Save size={15} />
            </Button>
          </form>
          <form action={deleteVariacaoAction} className="flex items-end pb-0">
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="produto_id" value={produtoId} />
            <ConfirmButton
              message={`Excluir a variação "${v.sku ?? "sem SKU"}"?`}
              title="Excluir"
              aria-label="Excluir variação"
              className="inline-flex h-9 w-9 items-center justify-center rounded-ui bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors"
            >
              <Trash2 size={15} />
            </ConfirmButton>
          </form>
        </div>
      </td>
    </tr>
  );
}
