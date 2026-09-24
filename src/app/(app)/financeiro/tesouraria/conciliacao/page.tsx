import { AlertTriangle, Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AtualizarExtratoButton } from "@/components/finance/atualizar-extrato-button";
import { getConciliacaoData, getTransferenciasIsaacPendentes } from "@/lib/data/conciliacao";
import { getDebitosData } from "@/lib/data/debitos";
import { JANELA_DIAS } from "@/lib/conciliacao/casar-transferencia-isaac";
import { conciliarExtratoAction, ignorarExtratoAction } from "@/lib/actions/conciliacao";
import { requirePermission } from "@/lib/auth/session";
import { money } from "@/lib/constants";
import { DebitosTabs, parseDebitosTab } from "@/components/finance/debitos-tabs";
import { DebitosAClassificar } from "@/components/finance/debitos-a-classificar";
import { DebitosSugestoes } from "@/components/finance/debitos-sugestoes";
import { DebitosTransferencias } from "@/components/finance/debitos-transferencias";

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function ConciliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; conta?: string; de?: string; ate?: string; debitos?: string }>;
}) {
  await requirePermission("financeiro.conciliacao", "read");
  const params = await searchParams;
  const status = params.status ?? "pendente";
  const abaDebitos = parseDebitosTab(params.debitos);
  const [data, transferenciasIsaac, debitosData] = await Promise.all([
    getConciliacaoData({
      status,
      contaId: params.conta || undefined,
      de: params.de || undefined,
      ate: params.ate || undefined,
    }),
    getTransferenciasIsaacPendentes(),
    getDebitosData(),
  ]);

  // Vencida sem crédito é dinheiro que deveria ter entrado. O resto ainda está
  // dentro do prazo e aparece só como informação.
  const isaacAtrasadas = transferenciasIsaac.filter((t) => t.atrasoDias > JANELA_DIAS);

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

      {transferenciasIsaac.length > 0 ? (
        <Panel className={isaacAtrasadas.length > 0 ? "border border-danger/30" : undefined}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/60">
              <AlertTriangle size={12} className={isaacAtrasadas.length > 0 ? "text-danger" : "text-ink/60"} />
              Repasse isaac aguardando crédito
            </div>
            <span className="text-xs text-ink/60">
              {isaacAtrasadas.length > 0
                ? `${isaacAtrasadas.length} vencida(s) sem crédito no extrato`
                : "Nenhuma vencida — dentro do prazo"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                  <th className="px-3 py-2">Prevista</th>
                  <th className="px-3 py-2">Unidade</th>
                  <th className="px-3 py-2">Competência</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {transferenciasIsaac.map((t) => {
                  const atrasada = t.atrasoDias > JANELA_DIAS;
                  return (
                    <tr key={t.id} className="border-b border-line/60">
                      <td className="px-3 py-2 text-ink">{dateText(t.dataPrevista)}</td>
                      <td className="px-3 py-2 text-ink/70">{t.unidadeNome}</td>
                      <td className="px-3 py-2 text-ink/70">{t.competenciaRepasse}</td>
                      <td className="px-3 py-2 text-right font-semibold text-ink">{money.format(t.valor)}</td>
                      <td className={`px-3 py-2 ${atrasada ? "font-semibold text-danger" : "text-ink/60"}`}>
                        {atrasada ? `${t.atrasoDias} dias de atraso` : "no prazo"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel className="grid gap-4">
        <DebitosTabs
          active={abaDebitos}
          counts={{
            "a-classificar": debitosData.aClassificar.reduce((n, g) => n + g.movimentos.length, 0),
            sugestoes: debitosData.sugestoes.length,
            transferencias:
              debitosData.transferenciasAuto.length +
              debitosData.transferenciasAmbiguas.length +
              debitosData.contaPropriaSemPar.length,
          }}
        />
        {abaDebitos === "a-classificar" ? <DebitosAClassificar data={debitosData} /> : null}
        {abaDebitos === "sugestoes" ? <DebitosSugestoes data={debitosData} /> : null}
        {abaDebitos === "transferencias" ? <DebitosTransferencias data={debitosData} /> : null}
      </Panel>

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
                  {conta.apelido ?? `${conta.agencia ?? "-"} / ${conta.conta}`}
                  {conta.empresaNome ? ` — ${conta.empresaNome}` : " — sem empresa"}
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
              {linha.tipo === "credito" ? (
                <form action={ignorarExtratoAction} className="justify-self-start lg:justify-self-end">
                  <input type="hidden" name="id" value={linha.id} />
                  <Button type="submit" variant="ghost" className="text-xs">Ignorar</Button>
                </form>
              ) : (
                <span className="justify-self-start text-xs text-ink/50 lg:justify-self-end">
                  Débito: classifique ou ignore na aba acima
                </span>
              )}
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
