"use client";

import { Trash2 } from "lucide-react";
import { upsertBracketAction, deleteBracketAction } from "@/lib/actions/brackets";
import type { InssBracketRow, IrBracketRow } from "@/lib/data/brackets";

type Props =
  | { table: "inss"; vigencia: string; brackets: InssBracketRow[] }
  | { table: "ir"; vigencia: string; brackets: IrBracketRow[] };

export function BracketsTable(props: Props) {
  const { table, vigencia, brackets } = props;
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-surface">
      <table className="ds-dt min-w-[700px]">
        <thead>
          <tr>
            <th className="w-16">Ordem</th>
            <th>De (R$)</th>
            <th>Até (R$)</th>
            <th>Alíquota</th>
            <th>Parc. deduzir (R$)</th>
            {table === "ir" ? <th>Ded. dependente (R$)</th> : null}
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {brackets.length === 0 ? (
            <tr>
              <td colSpan={table === "ir" ? 7 : 6} className="text-center text-ink/50 py-8">
                Nenhuma faixa nesta vigência.
              </td>
            </tr>
          ) : null}
          {brackets.map((b) => (
            <tr key={b.id}>
              <form action={upsertBracketAction} className="contents">
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="vigencia_inicio" value={vigencia} />
                <td>
                  <input name="ordem" type="number" min="1" defaultValue={b.ordem} className="w-16 tabular-nums" />
                </td>
                <td>
                  <input name="valor_de" type="number" step="0.01" min="0" defaultValue={b.valor_de} className="tabular-nums" />
                </td>
                <td>
                  <input
                    name="valor_ate"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={b.valor_ate ?? ""}
                    placeholder="(sem teto)"
                    className="tabular-nums"
                  />
                </td>
                <td>
                  <input name="aliquota" type="number" step="0.0001" min="0" max="1" defaultValue={b.aliquota} className="tabular-nums" />
                </td>
                <td>
                  <input name="parcela_deduzir" type="number" step="0.01" min="0" defaultValue={b.parcela_deduzir} className="tabular-nums" />
                </td>
                {table === "ir" ? (
                  <td>
                    <input
                      name="deducao_dependente"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={(b as IrBracketRow).deducao_dependente}
                      className="tabular-nums"
                    />
                  </td>
                ) : null}
                <td className="text-right">
                  <button type="submit" className="text-xs font-semibold text-brand hover:underline mr-3">Salvar</button>
                </td>
              </form>
              <td className="text-right">
                <form
                  action={deleteBracketAction}
                  onSubmit={(e) => {
                    if (!confirm("Excluir esta faixa?")) e.preventDefault();
                  }}
                  className="inline"
                >
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="table" value={table} />
                  <button type="submit" className="text-xs font-semibold text-danger hover:underline inline-flex items-center gap-1">
                    <Trash2 size={12} /> Remover
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {/* Linha "nova faixa" */}
          <tr>
            <form action={upsertBracketAction} className="contents">
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="vigencia_inicio" value={vigencia} />
              <td>
                <input name="ordem" type="number" min="1" defaultValue={brackets.length + 1} className="w-16 tabular-nums" />
              </td>
              <td>
                <input name="valor_de" type="number" step="0.01" min="0" placeholder="0,00" className="tabular-nums" />
              </td>
              <td>
                <input name="valor_ate" type="number" step="0.01" min="0" placeholder="(sem teto)" className="tabular-nums" />
              </td>
              <td>
                <input name="aliquota" type="number" step="0.0001" min="0" max="1" placeholder="0,1500" className="tabular-nums" />
              </td>
              <td>
                <input name="parcela_deduzir" type="number" step="0.01" min="0" placeholder="0,00" className="tabular-nums" />
              </td>
              {table === "ir" ? (
                <td>
                  <input name="deducao_dependente" type="number" step="0.01" min="0" placeholder="0,00" className="tabular-nums" />
                </td>
              ) : null}
              <td className="text-right">
                <button type="submit" className="text-xs font-semibold text-success hover:underline">+ Adicionar faixa</button>
              </td>
            </form>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
