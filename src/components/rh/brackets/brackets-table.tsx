"use client";

import { Trash2 } from "lucide-react";
import { upsertBracketAction, deleteBracketAction } from "@/lib/actions/brackets";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { InssBracketRow, IrBracketRow } from "@/lib/data/brackets";

type Props =
  | { table: "inss"; vigencia: string; brackets: InssBracketRow[] }
  | { table: "ir"; vigencia: string; brackets: IrBracketRow[] };

export function BracketsTable(props: Props) {
  const { table, vigencia, brackets } = props;
  const newFormId = `bracket-new-${table}`;
  const confirm = useConfirm();

  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-surface">
      {/* Hidden forms — one per row (HTML form attribute lets inputs/buttons live in <tr> cells while submitting to the right form) */}
      {brackets.map((b) => (
        <form
          key={`form-${b.id}`}
          id={`bracket-upsert-${b.id}`}
          action={upsertBracketAction}
        />
      ))}
      {brackets.map((b) => (
        <form
          key={`del-${b.id}`}
          id={`bracket-del-${b.id}`}
          action={deleteBracketAction}
        />
      ))}
      <form id={newFormId} action={upsertBracketAction} />

      <table className="ds-dt min-w-[700px]">
        <thead>
          <tr>
            <th className="w-16">Ordem</th>
            <th>De (R$)</th>
            <th>Até (R$)</th>
            <th>Alíquota</th>
            <th>Parc. deduzir (R$)</th>
            {table === "ir" ? <th>Ded. dependente (R$)</th> : null}
            <th className="text-right" colSpan={2}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {brackets.length === 0 ? (
            <tr>
              <td colSpan={table === "ir" ? 8 : 7} className="text-center text-ink/60 py-8">
                Nenhuma faixa nesta vigência.
              </td>
            </tr>
          ) : null}
          {brackets.map((b) => {
            const fid = `bracket-upsert-${b.id}`;
            const did = `bracket-del-${b.id}`;
            return (
              <tr key={b.id}>
                <td>
                  <input form={fid} type="hidden" name="id" value={b.id} />
                  <input form={fid} type="hidden" name="table" value={table} />
                  <input form={fid} type="hidden" name="vigencia_inicio" value={vigencia} />
                  <input form={did} type="hidden" name="id" value={b.id} />
                  <input form={did} type="hidden" name="table" value={table} />
                  <input form={fid} name="ordem" type="number" min="1" defaultValue={b.ordem} className="w-16 tabular-nums" />
                </td>
                <td>
                  <input form={fid} name="valor_de" type="number" step="0.01" min="0" defaultValue={b.valor_de} className="tabular-nums" />
                </td>
                <td>
                  <input
                    form={fid}
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
                  <input form={fid} name="aliquota" type="number" step="0.0001" min="0" max="1" defaultValue={b.aliquota} className="tabular-nums" />
                </td>
                <td>
                  <input form={fid} name="parcela_deduzir" type="number" step="0.01" min="0" defaultValue={b.parcela_deduzir} className="tabular-nums" />
                </td>
                {table === "ir" ? (
                  <td>
                    <input
                      form={fid}
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
                  <button form={fid} type="submit" className="text-xs font-semibold text-brand hover:underline">Salvar</button>
                </td>
                <td className="text-right pl-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-danger hover:underline inline-flex items-center gap-1"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Remover faixa",
                        message: "Tem certeza que quer remover esta faixa?",
                        confirmLabel: "Remover",
                        variant: "danger",
                      });
                      if (ok) {
                        (document.getElementById(did) as HTMLFormElement | null)?.requestSubmit();
                      }
                    }}
                  >
                    <Trash2 size={12} /> Remover
                  </button>
                </td>
              </tr>
            );
          })}
          {/* Nova faixa */}
          <tr>
            <td>
              <input form={newFormId} type="hidden" name="table" value={table} />
              <input form={newFormId} type="hidden" name="vigencia_inicio" value={vigencia} />
              <input form={newFormId} name="ordem" type="number" min="1" defaultValue={brackets.length + 1} className="w-16 tabular-nums" />
            </td>
            <td>
              <input form={newFormId} name="valor_de" type="number" step="0.01" min="0" placeholder="0,00" className="tabular-nums" />
            </td>
            <td>
              <input form={newFormId} name="valor_ate" type="number" step="0.01" min="0" placeholder="(sem teto)" className="tabular-nums" />
            </td>
            <td>
              <input form={newFormId} name="aliquota" type="number" step="0.0001" min="0" max="1" placeholder="0,1500" className="tabular-nums" />
            </td>
            <td>
              <input form={newFormId} name="parcela_deduzir" type="number" step="0.01" min="0" placeholder="0,00" className="tabular-nums" />
            </td>
            {table === "ir" ? (
              <td>
                <input form={newFormId} name="deducao_dependente" type="number" step="0.01" min="0" placeholder="0,00" className="tabular-nums" />
              </td>
            ) : null}
            <td className="text-right" colSpan={2}>
              <button form={newFormId} type="submit" className="text-xs font-semibold text-success hover:underline">+ Adicionar faixa</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
