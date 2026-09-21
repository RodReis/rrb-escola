import Link from "next/link";
import { CheckCircle2, Pencil, XCircle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";
import { cancelLancamentoAction, payLancamentoAction } from "@/lib/actions/lancamentos";
import { displayDespesaStatus } from "@/lib/despesas/status";
import type { LancamentoRow as LancamentoRowType } from "@/lib/data/lancamentos";

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

export function LancamentoRow({ l }: { l: LancamentoRowType }) {
  const status = displayDespesaStatus(l);
  const isReceita = l.tipo === "receita";
  return (
    <tr className="border-t border-line transition hover:bg-muted/40">
      <td className="py-2.5 px-3">
        <Link
          href={`/financeiro/lancamentos/${l.id}/editar`}
          className="font-medium text-ink hover:text-brand hover:underline"
        >
          {l.descricao}
        </Link>
      </td>
      <td className="py-2.5 px-3">
        <span
          className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
            isReceita ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          {isReceita ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
          {isReceita ? "Receita" : "Despesa"}
        </span>
      </td>
      <td className="py-2.5 px-3 text-ink/70">{l.categoria_nome ?? "—"}</td>
      <td className="py-2.5 px-3 text-ink/70">{l.contraparte ?? "—"}</td>
      <td className="py-2.5 px-3 text-ink/70 tabular-nums">{dateText(l.data_vencimento)}</td>
      <td className="py-2.5 px-3 text-ink/70 tabular-nums">{dateText(l.data_pagamento)}</td>
      <td
        className={`py-2.5 px-3 text-right font-semibold tabular-nums ${
          isReceita ? "text-success" : "text-ink"
        }`}
      >
        {isReceita ? "+" : "−"}{money.format(l.valor)}
      </td>
      <td className="py-2.5 px-3">
        <StatusPill tone={tones[status]}>{status}</StatusPill>
      </td>
      <td className="py-2.5 px-3 text-right">
        <div className="inline-flex items-center gap-1">
          {l.status === "aberta" ? (
            <form action={payLancamentoAction}>
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="data_pagamento" value={new Date().toISOString().slice(0, 10)} />
              <Button
                type="submit"
                variant="ghost"
                title="Marcar como pago"
                aria-label="Marcar como pago"
                className="!h-7 !min-w-0 !px-2 text-success hover:bg-success/10"
              >
                <CheckCircle2 size={16} />
              </Button>
            </form>
          ) : null}
          <Link
            href={`/financeiro/lancamentos/${l.id}/editar`}
            title="Editar"
            aria-label="Editar lançamento"
            className="inline-flex h-7 w-7 items-center justify-center rounded-ui text-ink/60 hover:bg-muted hover:text-ink"
          >
            <Pencil size={14} />
          </Link>
          {l.status !== "cancelada" ? (
            <form action={cancelLancamentoAction}>
              <input type="hidden" name="id" value={l.id} />
              <Button
                type="submit"
                variant="ghost"
                title="Cancelar"
                aria-label="Cancelar lançamento"
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
