"use client";

import { useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { money } from "@/lib/constants";
import { updateVariacaoAction, deleteVariacaoAction } from "@/lib/actions/comercial";
import type { VariacaoRow } from "@/lib/data/comercial";

// Linha de variação: modo leitura (botões editar/excluir) ou edição inline.
// No modo edição, a <tr> vira um <form> via display:contents para que os
// hidden inputs do CurrencyInput fiquem dentro do form (senao nao submetem).
export function VariacaoRowItem({ v, produtoId }: { v: VariacaoRow; produtoId: string }) {
  const [editing, setEditing] = useState(false);
  const [preco, setPreco] = useState(v.preco_venda);
  const [custo, setCusto] = useState(v.custo);

  if (!editing) {
    return (
      <tr className="border-t border-line">
        <td className="py-1.5 px-2 text-ink/70">{v.sku ?? "—"}</td>
        <td className="py-1.5 px-2 text-right tabular-nums">{money.format(v.preco_venda)}</td>
        <td className="py-1.5 px-2 text-right tabular-nums">{money.format(v.custo)}</td>
        <td className="py-1.5 px-2 text-right tabular-nums">{v.estoque_minimo}</td>
        <td className="py-1.5 px-2">{v.ativo ? "Sim" : "Não"}</td>
        <td className="py-1.5 px-2 text-right">
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(true)}
              title="Editar"
              aria-label="Editar variação"
              className="!h-7 !w-7 !min-w-0 !px-0 text-ink/60 hover:bg-muted hover:text-ink"
            >
              <Pencil size={14} />
            </Button>
            <form action={deleteVariacaoAction} className="inline">
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="produto_id" value={produtoId} />
              <ConfirmButton
                message={`Excluir a variação "${v.sku ?? "sem SKU"}"?`}
                title="Excluir"
                aria-label="Excluir variação"
                className="inline-flex h-7 w-7 items-center justify-center rounded-ui text-danger hover:bg-danger/10"
              >
                <Trash2 size={14} />
              </ConfirmButton>
            </form>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line bg-muted/20">
      <td colSpan={6} className="p-0">
        <form action={updateVariacaoAction} className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] items-end gap-2 px-2 py-2">
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
          <div className="inline-flex items-center gap-1 pb-1">
            <Button type="submit" variant="secondary" title="Salvar" aria-label="Salvar" className="!h-8 !w-8 !min-w-0 !px-0">
              <Save size={14} />
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} title="Cancelar" aria-label="Cancelar" className="!h-8 !w-8 !min-w-0 !px-0">
              <X size={14} />
            </Button>
          </div>
        </form>
      </td>
    </tr>
  );
}
