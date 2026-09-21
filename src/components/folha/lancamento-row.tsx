"use client";

import { useState } from "react";
import { editarLancamentoAction } from "@/lib/actions/folha";
import { StatusPill } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";

type Rubrica = {
  codigo: string;
  nome: string;
  tipo: string;
  ordem_holerite: number;
};

type Lancamento = {
  id: string;
  valor: number;
  referencia: string | null;
  origem: string;
  valor_calculado: number | null;
  recorrente_parcelas: number | null;
  recorrente_parcela_atual: number | null;
  folha_rubricas: Rubrica | null;
};

type Props = {
  lancamento: Lancamento;
  editavel: boolean;
};

const ORIGEM_LABEL: Record<string, string> = {
  auto: "auto",
  manual: "manual",
  recorrente: "recorrente",
};

const ORIGEM_TONE: Record<string, "neutral" | "warning" | "success"> = {
  auto: "neutral",
  manual: "warning",
  recorrente: "success",
};

export function LancamentoRow({ lancamento, editavel }: Props) {
  const [editando, setEditando] = useState(false);

  const rubrica = lancamento.folha_rubricas;
  const origemLabel = ORIGEM_LABEL[lancamento.origem] ?? lancamento.origem;
  const origemTone = ORIGEM_TONE[lancamento.origem] ?? "neutral";

  const parcInfo =
    lancamento.recorrente_parcelas != null && lancamento.recorrente_parcela_atual != null
      ? ` (${lancamento.recorrente_parcela_atual}/${lancamento.recorrente_parcelas})`
      : "";

  return (
    <tr className="border-t">
      <td className="py-2 font-medium">{rubrica?.nome ?? "—"}</td>
      <td className="py-2 text-xs text-ink/60 tabular-nums">{lancamento.referencia ?? "—"}</td>
      <td className="py-2">
        <span className="inline-flex items-center gap-1">
          <StatusPill tone={origemTone}>
            {origemLabel}
            {parcInfo}
          </StatusPill>
          {lancamento.origem === "manual" && lancamento.valor_calculado != null && (
            <span
              className="cursor-help text-xs text-ink/40 underline decoration-dotted"
              title={`calculado: ${money.format(Number(lancamento.valor_calculado))}`}
            >
              *
            </span>
          )}
        </span>
      </td>
      <td className="py-2 text-right">
        {editando ? (
          <form
            action={async (fd) => {
              await editarLancamentoAction(fd);
              setEditando(false);
            }}
            className="inline-flex items-center gap-1"
          >
            <input type="hidden" name="lancamento_id" value={lancamento.id} />
            <input
              name="valor"
              type="number"
              step="0.01"
              defaultValue={lancamento.valor}
              className="w-28 rounded border border-line px-1 py-0.5 text-right text-sm"
              autoFocus
            />
            <button type="submit" className="text-xs font-semibold text-brand hover:underline">
              ok
            </button>
            <button
              type="button"
              className="text-xs text-ink/40 hover:text-ink/70"
              onClick={() => setEditando(false)}
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={!editavel}
            onClick={() => setEditando(true)}
            className="tabular-nums text-sm disabled:cursor-default disabled:opacity-70 enabled:hover:text-brand enabled:hover:underline"
          >
            {money.format(Number(lancamento.valor))}
          </button>
        )}
      </td>
    </tr>
  );
}
