import { Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AtualizarExtratoButton } from "@/components/finance/atualizar-extrato-button";
import { getConciliacaoData } from "@/lib/data/conciliacao";
import { conciliarExtratoAction, ignorarExtratoAction } from "@/lib/actions/conciliacao";
import { requirePermission } from "@/lib/auth/session";
import { money } from "@/lib/constants";

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function ConciliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; conta?: string; de?: string; ate?: string }>;
}) {
  await requirePermission("financeiro.conciliacao", "read");
  const params = await searchParams;
  const status = params.status ?? "pendente";
  const data = await getConciliacaoData({
    status,
    contaId: params.conta || undefined,
    de: params.de || undefined,
    ate: params.ate || undefined,
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Tesouraria", href: "/financeiro/tesouraria" }, { label: "Conciliação" }]}
        title="Conciliação Bancária"
        description="Extrato Sicoob contra pagamentos e livro-razão."
        counter={status}
        actions={<AtualizarExtratoButton />}
        kpis={[
          { label: "Linhas", value: data.extrato.length.toLocaleString("pt-BR") },
          { label: "Saldo filtrado", value: money.format(data.totalExtrato) },
          { label: "Contas ativas", value: data.contas.length.toLocaleString("pt-BR") },
        ]}
      />

      <Panel>
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/60">
          <Filter size={12} />
          Filtros
        </div>
        <form className="flex flex-wrap items-end gap-3">
          <label>
            Conta
            <select name="conta" defaultValue={params.conta ?? ""}>
              <option value="">Todas as contas</option>
              {data.contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.agencia ?? "-"} / {conta.conta}
                </option>
              ))}
            </select>
          </label>
          <label>
            De
            <input name="de" type="date" defaultValue={params.de ?? ""} />
          </label>
          <label>
            Até
            <input name="ate" type="date" defaultValue={params.ate ?? ""} />
          </label>
          <label>
            Situação
            <select name="status" defaultValue={status}>
              <option value="pendente">Pendentes</option>
              <option value="auto">Conciliadas auto</option>
              <option value="manual">Conciliadas manual</option>
              <option value="ignorado">Ignoradas</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">Aplicar</Button>
        </form>
      </Panel>

      <section className="grid gap-3">
        {data.extrato.length === 0 ? (
          <Panel>
            <p className="py-8 text-center text-sm text-ink/60">Nenhuma linha de extrato neste filtro.</p>
          </Panel>
        ) : null}

        {data.extrato.map((linha) => (
          <Panel key={linha.id} className="grid gap-3">
            <div className="grid gap-3 lg:grid-cols-[130px_120px_1fr_220px] lg:items-center">
              <span className="text-sm text-ink/60">{dateText(linha.data)}</span>
              <strong className={`tabular-nums ${linha.tipo === "credito" ? "text-moss" : "text-clay"}`}>
                {linha.tipo === "credito" ? "+" : "-"} {money.format(Number(linha.valor))}
              </strong>
              <div>
                <p className="font-semibold text-ink">{linha.descricao}</p>
                <p className="text-xs text-ink/60">
                  {linha.end_to_end_id ?? (linha.tipo === "credito" ? "sem candidato por E2E" : "sem E2E")}
                </p>
              </div>
              <form action={ignorarExtratoAction} className="justify-self-start lg:justify-self-end">
                <input type="hidden" name="id" value={linha.id} />
                <Button type="submit" variant="ghost" className="text-xs">Ignorar</Button>
              </form>
            </div>

            {status === "pendente" ? (
              <form
                action={conciliarExtratoAction}
                className="grid gap-3 border-t border-line pt-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
              >
                <input type="hidden" name="id" value={linha.id} />
                <label>
                  Pagamento
                  <select name="pagamento_id" defaultValue="">
                    <option value="">Selecione...</option>
                    {data.pagamentos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {dateText(p.data_pagamento)} - {money.format(Number(p.valor_pago))} - {p.forma_pagamento}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lançamento
                  <select name="lancamento_id" defaultValue="">
                    <option value="">Selecione...</option>
                    {data.lancamentos.map((l) => (
                      <option key={l.id} value={l.id}>
                        {dateText(l.data_vencimento)} - {money.format(Number(l.valor))} - {l.descricao}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="primary">Conciliar</Button>
              </form>
            ) : null}
          </Panel>
        ))}
      </section>
    </div>
  );
}
