"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { upsertBracketAction, deleteBracketAction } from "@/lib/actions/brackets";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import type { InssBracketRow, IrBracketRow } from "@/lib/data/brackets";

type Table = "inss" | "ir";
type BracketOf<T extends Table> = T extends "ir" ? IrBracketRow : InssBracketRow;

type Props =
  | { table: "inss"; vigencia: string; brackets: InssBracketRow[] }
  | { table: "ir"; vigencia: string; brackets: IrBracketRow[] };

/**
 * upsertBracketAction/deleteBracketAction sao contrato A (redirect() tanto
 * no sucesso quanto no erro) — nao migradas nesta task. useAction relanca o
 * NEXT_REDIRECT; confirmacao e loading funcionam desde ja, o toast so passa
 * a valer quando as actions virarem {ok, redirectTo} (Fase 4).
 */
function BracketRow<T extends Table>({
  table,
  vigencia,
  bracket,
}: {
  table: T;
  vigencia: string;
  bracket: BracketOf<T>;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const save = useAction(upsertBracketAction, { error: "Falha ao salvar a faixa." });
  const remove = useAction(deleteBracketAction, {
    confirm: {
      title: "Remover faixa",
      message: "Tem certeza que quer remover esta faixa?",
      confirmLabel: "Remover",
      variant: "danger",
    },
    error: "Falha ao remover a faixa.",
  });

  function handleSave() {
    if (!rowRef.current) return;
    // Os inputs da linha nao estao dentro de um <form> (ficavam ligados por
    // atributo `form=` a um <form> oculto fora da arvore); FormData aceita
    // qualquer elemento ancestral, entao lemos direto do <tr>.
    const fd = new FormData();
    rowRef.current.querySelectorAll("input").forEach((input) => {
      if (input.name) fd.append(input.name, input.value);
    });
    fd.set("table", table);
    fd.set("vigencia_inicio", vigencia);
    save.run(fd);
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", bracket.id);
    fd.set("table", table);
    remove.run(fd);
  }

  return (
    <tr ref={rowRef}>
      <td>
        <input type="hidden" name="id" value={bracket.id} />
        <input
          name="ordem"
          type="number"
          min="1"
          defaultValue={bracket.ordem}
          className="w-16 tabular-nums"
        />
      </td>
      <td>
        <input name="valor_de" type="number" step="0.01" min="0" defaultValue={bracket.valor_de} className="tabular-nums" />
      </td>
      <td>
        <input
          name="valor_ate"
          type="number"
          step="0.01"
          min="0"
          defaultValue={bracket.valor_ate ?? ""}
          placeholder="(sem teto)"
          className="tabular-nums"
        />
      </td>
      <td>
        <input name="aliquota" type="number" step="0.0001" min="0" max="1" defaultValue={bracket.aliquota} className="tabular-nums" />
      </td>
      <td>
        <input name="parcela_deduzir" type="number" step="0.01" min="0" defaultValue={bracket.parcela_deduzir} className="tabular-nums" />
      </td>
      {table === "ir" ? (
        <td>
          <input
            name="deducao_dependente"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(bracket as IrBracketRow).deducao_dependente}
            className="tabular-nums"
          />
        </td>
      ) : null}
      <td className="text-right">
        <button
          type="button"
          onClick={handleSave}
          disabled={save.pending}
          className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
        >
          {save.pending ? "Salvando…" : "Salvar"}
        </button>
      </td>
      <td className="text-right pl-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={remove.pending}
          className="text-xs font-semibold text-danger hover:underline inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Trash2 size={12} /> {remove.pending ? "Removendo…" : "Remover"}
        </button>
      </td>
    </tr>
  );
}

function NovaFaixaRow<T extends Table>({
  table,
  vigencia,
  proximaOrdem,
}: {
  table: T;
  vigencia: string;
  proximaOrdem: number;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const create = useAction(upsertBracketAction, { error: "Falha ao adicionar a faixa." });

  function handleCreate() {
    if (!rowRef.current) return;
    const fd = new FormData();
    rowRef.current.querySelectorAll("input").forEach((input) => {
      if (input.name) fd.append(input.name, input.value);
    });
    fd.set("table", table);
    fd.set("vigencia_inicio", vigencia);
    create.run(fd);
  }

  return (
    <tr ref={rowRef}>
      <td>
        <input name="ordem" type="number" min="1" defaultValue={proximaOrdem} className="w-16 tabular-nums" />
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
      <td className="text-right" colSpan={2}>
        <Button type="button" variant="secondary" loading={create.pending} onClick={handleCreate} className="min-h-0 px-2.5 py-1.5 text-xs">
          + Adicionar faixa
        </Button>
      </td>
    </tr>
  );
}

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
          {table === "ir"
            ? brackets.map((b) => (
                <BracketRow key={b.id} table="ir" vigencia={vigencia} bracket={b as IrBracketRow} />
              ))
            : brackets.map((b) => (
                <BracketRow key={b.id} table="inss" vigencia={vigencia} bracket={b as InssBracketRow} />
              ))}
          {table === "ir" ? (
            <NovaFaixaRow table="ir" vigencia={vigencia} proximaOrdem={brackets.length + 1} />
          ) : (
            <NovaFaixaRow table="inss" vigencia={vigencia} proximaOrdem={brackets.length + 1} />
          )}
        </tbody>
      </table>
    </div>
  );
}
