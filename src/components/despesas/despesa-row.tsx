import Link from "next/link";
import { CheckCircle2, Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";
import {
  cancelDespesaAction,
  payDespesaAction
} from "@/lib/actions/despesas";
import { displayDespesaStatus } from "@/lib/despesas/status";
import type { DespesaRow as DespesaRowType } from "@/lib/data/despesas";

const tones: Record<string, StatusTone> = {
  aberta: "warning",
  vencida: "danger",
  paga: "success",
  cancelada: "neutral"
};

function dateText(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function DespesaRow({ d }: { d: DespesaRowType }) {
  const status = displayDespesaStatus(d);
  return (
    <tr className="border-t border-line transition hover:bg-muted/40">
      <td className="py-2.5 px-3">
        <Link
          href={`/despesas/${d.id}/editar`}
          className="font-medium text-ink hover:text-brand hover:underline"
        >
          {d.descricao}
        </Link>
      </td>
      <td className="py-2.5 px-3 text-ink/70">{d.categoria_nome ?? "—"}</td>
      <td className="py-2.5 px-3">
        <span
          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
            d.tipo === "fixa" ? "bg-brand/10 text-brand" : "bg-muted text-ink/60"
          }`}
        >
          {d.tipo === "fixa" ? "Fixa" : "Variável"}
        </span>
      </td>
      <td className="py-2.5 px-3 text-ink/70">{d.fornecedor ?? "—"}</td>
      <td className="py-2.5 px-3 text-ink/70 tabular-nums">{dateText(d.data_vencimento)}</td>
      <td className="py-2.5 px-3 text-ink/70 tabular-nums">{dateText(d.data_pagamento)}</td>
      <td className="py-2.5 px-3 text-right font-semibold text-ink tabular-nums">{money.format(d.valor)}</td>
      <td className="py-2.5 px-3">
        <StatusPill tone={tones[status]}>{status}</StatusPill>
      </td>
      <td className="py-2.5 px-3 text-right">
        <div className="inline-flex items-center gap-1">
          {d.status === "aberta" ? (
            <form action={payDespesaAction}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="data_pagamento" value={new Date().toISOString().slice(0, 10)} />
              <Button
                type="submit"
                variant="ghost"
                title="Marcar como paga"
                aria-label="Marcar como paga"
                className="!h-7 !min-w-0 !px-2 text-success hover:bg-success/10"
              >
                <CheckCircle2 size={16} />
              </Button>
            </form>
          ) : null}
          <Link
            href={`/despesas/${d.id}/editar`}
            title="Editar"
            aria-label="Editar despesa"
            className="inline-flex h-7 w-7 items-center justify-center rounded-ui text-ink/60 hover:bg-muted hover:text-ink"
          >
            <Pencil size={14} />
          </Link>
          {d.status !== "cancelada" ? (
            <form action={cancelDespesaAction}>
              <input type="hidden" name="id" value={d.id} />
              <Button
                type="submit"
                variant="ghost"
                title="Cancelar"
                aria-label="Cancelar despesa"
                className="!h-7 !min-w-0 !px-2 text-danger hover:bg-danger/10"
              >
                <XCircle size={16} />
              </Button>
            </form>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
