import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { PixAvulsoForm } from "@/components/finance/pix-avulso-form";
import { requirePermission } from "@/lib/auth/session";
import { getCobrancasPixData } from "@/lib/data/tesouraria";
import { money } from "@/lib/constants";

function dateText(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export default async function CobrancasPixPage() {
  await requirePermission("financeiro.tesouraria", "read");
  const data = await getCobrancasPixData();

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Tesouraria", href: "/financeiro/tesouraria" }, { label: "Cobranças Pix" }]}
        title="Cobranças Pix"
        description="Pix de recebimento da escola com origem avulsa ou vinculada."
        counter={data.pix.length.toLocaleString("pt-BR")}
      />

      <Panel className="grid gap-4">
        <h2 className="text-sm font-bold uppercase tracking-kicker text-ink/60">Pix avulso</h2>
        {data.contas.length === 0 ? (
          <p className="text-sm text-ink/60">
            Cadastre uma conta bancária ativa na Tesouraria antes de gerar Pix.
          </p>
        ) : (
          <PixAvulsoForm contas={data.contas} />
        )}
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="text-sm font-bold uppercase tracking-kicker text-ink/60">Cobranças geradas</h2>
        {data.pix.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/60">Nenhuma cobrança Pix gerada ainda.</p>
        ) : null}
        {data.pix.map((pix) => (
          <div
            key={pix.id}
            className="grid gap-2 border-t border-line py-3 text-sm md:grid-cols-[110px_120px_1fr_110px] md:items-center"
          >
            <span className="text-ink/60">{dateText(pix.criado_em)}</span>
            <strong className="tabular-nums">{money.format(Number(pix.valor))}</strong>
            <div>
              <p className="font-semibold text-ink">{pix.descricao}</p>
              <p className="text-xs text-ink/60">{pix.origem_tipo} - {pix.txid}</p>
            </div>
            <span className="text-xs font-bold uppercase tracking-kicker text-ink/60">{pix.status}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
