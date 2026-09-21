import { Landmark, QrCode } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
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
              <span
                className={`text-xs font-bold uppercase tracking-kicker ${
                  conta.ativo ? "text-moss" : "text-ink/50"
                }`}
              >
                {conta.ativo ? "ativa" : "inativa"}
              </span>
            </div>
            <p className="text-sm text-ink/70">
              Banco {conta.banco} - agência {conta.agencia ?? "-"} - conta {conta.conta}
            </p>
            <p className="text-xs text-ink/60">Chave Pix: {conta.chave_pix ?? "não cadastrada"}</p>
            <p className="text-xs text-ink/60">Saldo sincronizado: {dateText(conta.saldo_sincronizado_em)}</p>
            <form action={alternarContaBancariaAction}>
              <input type="hidden" name="id" value={conta.id} />
              <input type="hidden" name="ativo" value={String(conta.ativo)} />
              <Button type="submit" variant="ghost" className="px-0 text-xs">
                {conta.ativo ? "Desativar" : "Ativar"}
              </Button>
            </form>
          </Panel>
        ))}
      </section>

      <Panel className="grid gap-4">
        <h2 className="text-sm font-bold uppercase tracking-kicker text-ink/60">Nova conta Sicoob</h2>
        <form action={salvarContaBancariaAction} className="grid gap-4 md:grid-cols-3">
          <label>
            Apelido
            <input name="apelido" maxLength={60} placeholder="Ex.: Conta principal" />
          </label>
          <label>
            Cooperativa
            <input name="cooperativa" maxLength={10} inputMode="numeric" placeholder="Ex.: 3300" />
          </label>
          <label>
            Agência
            <input name="agencia" maxLength={10} inputMode="numeric" placeholder="Ex.: 3300" />
          </label>
          <label>
            Conta
            <input name="conta" required maxLength={20} inputMode="numeric" placeholder="Ex.: 27570" />
          </label>
          <label className="md:col-span-2">
            Chave Pix
            <input name="chave_pix" maxLength={120} placeholder="CNPJ, e-mail ou chave aleatória" />
          </label>
          <div className="md:col-span-3">
            <Button type="submit" variant="primary">Salvar conta</Button>
          </div>
        </form>
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="text-sm font-bold uppercase tracking-kicker text-ink/60">Últimos Pix recebidos</h2>
        {data.recebidos.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/60">Nenhum Pix recebido registrado.</p>
        ) : null}
        {data.recebidos.map((pix) => (
          <div key={pix.id} className="grid gap-2 border-t border-line py-3 text-sm md:grid-cols-[130px_120px_1fr]">
            <span className="text-ink/60">{dateText(pix.recebido_em)}</span>
            <strong className="tabular-nums">{money.format(Number(pix.valor))}</strong>
            <span className="text-ink/60">{pix.txid ?? pix.end_to_end_id}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
