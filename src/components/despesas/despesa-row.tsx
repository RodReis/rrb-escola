import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
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
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function DespesaRow({ d }: { d: DespesaRowType }) {
  const status = displayDespesaStatus(d);
  return (
    <tr className="border-t border-line">
      <td className="py-2">
        <Link href={`/despesas/${d.id}/editar`} className="hover:underline">
          {d.descricao}
        </Link>
      </td>
      <td className="py-2">{d.categoria_nome ?? "-"}</td>
      <td className="py-2">{d.fornecedor ?? "-"}</td>
      <td className="py-2">{dateText(d.data_vencimento)}</td>
      <td className="py-2">{dateText(d.data_pagamento)}</td>
      <td className="py-2 text-right tabular-nums">{money.format(d.valor)}</td>
      <td className="py-2"><StatusPill tone={tones[status]}>{status}</StatusPill></td>
      <td className="py-2 text-right">
        <div className="inline-flex items-center gap-1">
          {d.status === "aberta" ? (
            <form action={payDespesaAction}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="data_pagamento" value={new Date().toISOString().slice(0, 10)} />
              <Button type="submit" variant="secondary">Pagar</Button>
            </form>
          ) : null}
          <ButtonLink href={`/despesas/${d.id}/editar`} variant="ghost">Editar</ButtonLink>
          {d.status !== "cancelada" ? (
            <form action={cancelDespesaAction}>
              <input type="hidden" name="id" value={d.id} />
              <Button type="submit" variant="ghost">Cancelar</Button>
            </form>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
