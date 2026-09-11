import { RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getConciliacaoData } from "@/lib/data/conciliacao";
import { atualizarExtratoAction, conciliarExtratoAction, ignorarExtratoAction } from "@/lib/actions/conciliacao";
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
        actions={
          <form action={atualizarExtratoAction}>
            <Button variant="secondary">
              <RefreshCcw size={14} /> Atualizar extrato
            </Button>
          </form>
        }
        kpis={[
          { label: "Linhas", value: data.extrato.length.toLocaleString("pt-BR") },
          { label: "Saldo filtrado", value: money.format(data.totalExtrato) },
          { label: "Contas ativas", value: data.contas.length.toLocaleString("pt-BR") },
        ]}
      />

      <form className="grid gap-3 md:grid-cols-[1fr_150px_150px_150px_auto]">
        <select name="conta" defaultValue={params.conta ?? ""}>
          <option value="">Todas as contas</option>
          {data.contas.map((conta) => (
            <option key={conta.id} value={conta.id}>
              {conta.agencia ?? "-"} / {conta.conta}
            </option>
          ))}
        </select>
        <input name="de" type="date" defaultValue={params.de ?? ""} />
        <input name="ate" type="date" defaultValue={params.ate ?? ""} />
        <select name="status" defaultValue={status}>
          <option value="pendente">Pendentes</option>
          <option value="auto">Conciliadas auto</option>
          <option value="manual">Conciliadas manual</option>
          <option value="ignorado">Ignoradas</option>
        </select>
        <button className="ds-button ds-button-secondary" type="submit">Filtrar</button>
      </form>

      <section className="grid gap-3">
        {data.extrato.length === 0 ? (
          <Panel>
            <p className="py-8 text-center text-sm text-muted">Nenhuma linha de extrato neste filtro.</p>
          </Panel>
        ) : null}

        {data.extrato.map((linha) => (
          <Panel key={linha.id} className="grid gap-3">
            <div className="grid gap-3 lg:grid-cols-[130px_120px_1fr_220px] lg:items-center">
              <span className="text-sm">{dateText(linha.data)}</span>
              <strong className={linha.tipo === "credito" ? "text-emerald-700" : "text-clay"}>
                {linha.tipo === "credito" ? "+" : "-"} {money.format(Number(linha.valor))}
              </strong>
              <div>
                <p className="font-semibold text-ink">{linha.descricao}</p>
                <p className="text-xs text-muted">
                  {linha.end_to_end_id ?? (linha.tipo === "credito" ? "sem candidato por E2E" : "sem E2E")}
                </p>
              </div>
              <form action={ignorarExtratoAction} className="justify-self-start lg:justify-self-end">
                <input type="hidden" name="id" value={linha.id} />
                <button className="text-xs font-black text-muted" type="submit">Ignorar</button>
              </form>
            </div>

            {status === "pendente" ? (
              <form action={conciliarExtratoAction} className="grid gap-2 md:grid-cols-[1fr_1fr_110px]">
                <input type="hidden" name="id" value={linha.id} />
                <select name="pagamento_id" defaultValue="">
                  <option value="">Pagamento...</option>
                  {data.pagamentos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {dateText(p.data_pagamento)} - {money.format(Number(p.valor_pago))} - {p.forma_pagamento}
                    </option>
                  ))}
                </select>
                <select name="lancamento_id" defaultValue="">
                  <option value="">Lançamento...</option>
                  {data.lancamentos.map((l) => (
                    <option key={l.id} value={l.id}>
                      {dateText(l.data_vencimento)} - {money.format(Number(l.valor))} - {l.descricao}
                    </option>
                  ))}
                </select>
                <button className="ds-button ds-button-primary text-xs" type="submit">Conciliar</button>
              </form>
            ) : null}
          </Panel>
        ))}
      </section>
    </div>
  );
}
