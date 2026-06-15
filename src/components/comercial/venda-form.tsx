"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { money } from "@/lib/constants";
import { FORMAS_PAGAMENTO } from "@/lib/validation/comercial";
import { totalVenda, cupomObrigatorio } from "@/lib/comercial/venda-calc";
import type { VariacaoOption } from "@/lib/data/comercial";

type ItemState = { variacao_id: string; quantidade: number; preco_unit: number };

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  variacoes: VariacaoOption[];
};

export function VendaForm({ action, variacoes }: Props) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [itens, setItens] = useState<ItemState[]>([]);
  const [forma, setForma] = useState<string>("");
  const [desconto, setDesconto] = useState<number>(0);

  const total = useMemo(() => totalVenda(itens, desconto), [itens, desconto]);
  const precisaCupom = cupomObrigatorio(forma);

  function addItem() {
    const first = variacoes[0];
    if (!first) return;
    setItens((prev) => [...prev, { variacao_id: first.id, quantidade: 1, preco_unit: first.preco_venda }]);
  }

  function updateItem(idx: number, patch: Partial<ItemState>) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function labelVariacao(v: VariacaoOption) {
    const attrs = Object.entries(v.atributos).map(([k, val]) => `${k}:${val}`).join(" ");
    return `${v.produto_nome}${v.sku ? ` (${v.sku})` : ""}${attrs ? ` — ${attrs}` : ""}`;
  }

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="itens" value={JSON.stringify(itens)} />

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          Cliente (nome livre)
          <input name="cliente_nome" maxLength={200} placeholder="Ex.: Maria (responsável)" />
        </label>
        <label>
          Data
          <input type="date" name="data_venda" required defaultValue={hoje} />
        </label>
        <label>
          Forma de pagamento
          <select name="forma_pagamento" value={forma} onChange={(e) => setForma(e.target.value)}>
            <option value="">—</option>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Nº cupom {precisaCupom ? "(obrigatório p/ cartão)" : ""}
          <input name="numero_cupom" maxLength={60} required={precisaCupom} placeholder="Cupom da maquininha" />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-kicker text-ink/55">Itens</h3>
          <Button type="button" variant="secondary" onClick={addItem} disabled={variacoes.length === 0}>
            <Plus size={14} /> Adicionar item
          </Button>
        </div>
        {variacoes.length === 0 ? (
          <p className="text-sm text-danger">Nenhuma variação ativa. Cadastre um produto com variação antes de vender.</p>
        ) : itens.length === 0 ? (
          <p className="text-sm text-ink/45">Nenhum item. Clique em &quot;Adicionar item&quot;.</p>
        ) : (
          <div className="grid gap-2">
            {itens.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
                <label className="text-xs">
                  Variação
                  <select
                    value={it.variacao_id}
                    onChange={(e) => {
                      const v = variacoes.find((x) => x.id === e.target.value);
                      updateItem(idx, { variacao_id: e.target.value, preco_unit: v?.preco_venda ?? it.preco_unit });
                    }}
                  >
                    {variacoes.map((v) => (
                      <option key={v.id} value={v.id}>{labelVariacao(v)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Qtd
                  <input
                    type="number"
                    min="1"
                    value={it.quantidade}
                    onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })}
                    className="w-20"
                  />
                </label>
                <label className="text-xs">
                  Preço
                  <CurrencyInput
                    name={`preco_${idx}`}
                    value={it.preco_unit}
                    onChange={(value) => updateItem(idx, { preco_unit: value })}
                    className="mt-1 w-28 rounded-ui border border-line bg-surface px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeItem(idx)}
                  aria-label="Remover item"
                  className="!h-9 !min-w-0 !px-2 text-danger hover:bg-danger/10"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          Desconto
          <input
            type="number"
            name="desconto"
            step="0.01"
            min="0"
            value={desconto}
            onChange={(e) => setDesconto(Number(e.target.value))}
          />
        </label>
        <div className="flex items-end justify-end">
          <div className="text-right">
            <div className="text-xs uppercase tracking-kicker text-ink/55">Total</div>
            <div className="text-2xl font-bold tabular-nums text-ink">{money.format(Math.max(total, 0))}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={itens.length === 0 || total <= 0}>
          Salvar venda (rascunho)
        </Button>
      </div>
    </form>
  );
}
