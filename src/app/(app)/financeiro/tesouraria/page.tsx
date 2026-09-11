import { Landmark, QrCode } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { getTesourariaData } from "@/lib/data/tesouraria";
import { money } from "@/lib/constants";
import { alternarContaBancariaAction, salvarContaBancariaAction } from "@/lib/actions/tesouraria";

function dateText(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

export default async function TesourariaPage() {
  await requirePermission("financeiro.tesouraria", "read");
  const data = await getTesourariaData();
  const totalAberto = data.pix
    .filter((p) => p.status === "ativa")
    .reduce((sum, p) => sum + Number(p.valor ?? 0), 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Financeiro", href: "/financeiro" }, { label: "Tesouraria" }]}
        title="Tesouraria"
        description="Contas bancárias da escola, Pix de recebimento e extrato conciliado."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/financeiro/tesouraria/cobrancas-pix" variant="secondary">
              <QrCode size={14} /> Cobranças Pix
            </ButtonLink>
            <ButtonLink href="/financeiro/tesouraria/conciliacao" variant="secondary">
              <Landmark size={14} /> Conciliação
            </ButtonLink>
          </div>
        }
        kpis={[
          { label: "Contas", value: data.contas.length.toLocaleString("pt-BR") },
          { label: "Pix ativos", value: data.pix.filter((p) => p.status === "ativa").length.toLocaleString("pt-BR") },
          { label: "Em aberto Pix", value: money.format(totalAberto) },
        ]}
      />

      <section className="grid gap-3 md:grid-cols-2">
        {data.contas.map((conta) => (
          <Panel key={conta.id} className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-ink">{conta.apelido ?? "Conta Sicoob"}</strong>
              <span className="text-xs font-semibold text-muted">{conta.ativo ? "ativa" : "inativa"}</span>
            </div>
            <p className="text-sm text-muted">
              Banco {conta.banco} - agência {conta.agencia ?? "-"} - conta {conta.conta}
            </p>
            <p className="text-xs text-muted">Chave Pix: {conta.chave_pix ?? "não cadastrada"}</p>
            <p className="text-xs text-muted">Saldo sincronizado: {dateText(conta.saldo_sincronizado_em)}</p>
            <form action={alternarContaBancariaAction}>
              <input type="hidden" name="id" value={conta.id} />
              <input type="hidden" name="ativo" value={String(conta.ativo)} />
              <button className="text-xs font-black text-brand" type="submit">
                {conta.ativo ? "Desativar" : "Ativar"}
              </button>
            </form>
          </Panel>
        ))}
      </section>

      <Panel className="grid gap-4">
        <h2 className="font-display text-xl text-ink">Nova conta Sicoob</h2>
        <form action={salvarContaBancariaAction} className="grid gap-3 md:grid-cols-6">
          <input name="apelido" placeholder="Apelido" />
          <input name="cooperativa" placeholder="Cooperativa" />
          <input name="agencia" placeholder="Agência" />
          <input name="conta" placeholder="Conta" required />
          <input name="chave_pix" placeholder="Chave Pix" className="md:col-span-2" />
          <button className="ds-button ds-button-primary md:col-span-1" type="submit">Salvar</button>
        </form>
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="font-display text-xl text-ink">Últimos Pix recebidos</h2>
        {data.recebidos.length === 0 ? <p className="text-sm text-muted">Nenhum Pix recebido registrado.</p> : null}
        {data.recebidos.map((pix) => (
          <div key={pix.id} className="grid gap-2 border-t border-line py-2 text-sm md:grid-cols-[130px_120px_1fr]">
            <span>{dateText(pix.recebido_em)}</span>
            <strong>{money.format(Number(pix.valor))}</strong>
            <span className="text-muted">{pix.txid ?? pix.end_to_end_id}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
