import { Plus, ShoppingCart, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { ButtonLink, Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { money } from "@/lib/constants";
import { getVendas } from "@/lib/data/comercial";
import { confirmarVendaAction, cancelarVendaAction } from "@/lib/actions/comercial";
import { requirePermission } from "@/lib/auth/session";
import { GerarPixOrigemButton } from "@/components/finance/gerar-pix-origem-button";

export const dynamic = "force-dynamic";

const tones: Record<string, StatusTone> = {
  rascunho: "warning",
  confirmada: "success",
  cancelada: "neutral"
};

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function VendasPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("comercial.vendas", "read");
  const { erro } = await searchParams;
  const vendas = await getVendas();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Comercial" }, { label: "Vendas" }]}
        title="Vendas"
        description="Vendas à vista. Confirmar gera a receita no livro-razão."
        counter={vendas.length.toLocaleString("pt-BR")}
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

      <div className="flex justify-end">
        <ButtonLink href="/comercial/vendas/nova" variant="primary">
          <Plus size={14} /> Nova venda
        </ButtonLink>
      </div>

      <Panel className="p-5">
        {vendas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-12 text-ink/60">
            <ShoppingCart size={28} />
            <p className="text-sm">Nenhuma venda registrada.</p>
            <ButtonLink href="/comercial/vendas/nova" variant="ghost" className="mt-2">
              <Plus size={14} /> Registrar primeira
            </ButtonLink>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3">Cliente</th>
                  <th className="py-2 px-3">Pagamento</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} className="border-t border-line transition hover:bg-muted/40">
                    <td className="py-2.5 px-3 text-ink/70 tabular-nums">{dateText(v.data_venda)}</td>
                    <td className="py-2.5 px-3 text-ink/70">{v.cliente_nome ?? "—"}</td>
                    <td className="py-2.5 px-3 text-ink/70">{v.forma_pagamento ?? "—"}</td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums">{money.format(v.total)}</td>
                    <td className="py-2.5 px-3"><StatusPill tone={tones[v.status]}>{v.status}</StatusPill></td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {v.status === "rascunho" ? (
                          <GerarPixOrigemButton
                            origemTipo="venda"
                            origemId={v.id}
                            valor={v.total}
                            descricao={`Venda ${v.cliente_nome ?? v.id}`}
                          />
                        ) : null}
                        {v.status === "rascunho" ? (
                          <form action={confirmarVendaAction}>
                            <input type="hidden" name="id" value={v.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              title="Confirmar venda"
                              aria-label="Confirmar venda"
                              className="!h-7 !min-w-0 !px-2 text-success hover:bg-success/10"
                            >
                              <CheckCircle2 size={16} />
                            </Button>
                          </form>
                        ) : null}
                        {v.status !== "cancelada" ? (
                          <form action={cancelarVendaAction} className="inline">
                            <input type="hidden" name="id" value={v.id} />
                            <ConfirmButton
                              message="Cancelar esta venda? O lançamento de receita será marcado como cancelado."
                              title="Cancelar venda"
                              aria-label="Cancelar venda"
                              className="inline-flex h-7 min-w-0 items-center justify-center rounded-ui px-2 text-danger hover:bg-danger/10"
                            >
                              <XCircle size={16} />
                            </ConfirmButton>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
