import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { gerarPixCobrancaFormAction } from "@/lib/actions/sicoob";
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
        <h2 className="font-display text-xl text-ink">Pix avulso</h2>
        <form action={gerarPixCobrancaFormAction} className="grid gap-3 md:grid-cols-[1fr_1fr_130px_140px]">
          <select name="conta_id" required>
            {data.contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.apelido ?? conta.conta}
              </option>
            ))}
          </select>
          <input name="descricao" placeholder="Descrição" required />
          <input name="valor" placeholder="Valor" inputMode="decimal" required />
          <button className="ds-button ds-button-primary" type="submit">Gerar Pix</button>
        </form>
      </Panel>

      <section className="grid gap-3">
        {data.pix.map((pix) => (
          <Panel key={pix.id} className="grid gap-2 md:grid-cols-[130px_120px_1fr_110px] md:items-center">
            <span className="text-sm">{dateText(pix.criado_em)}</span>
            <strong>{money.format(Number(pix.valor))}</strong>
            <div>
              <p className="font-semibold text-ink">{pix.descricao}</p>
              <p className="text-xs text-muted">{pix.origem_tipo} - {pix.txid}</p>
            </div>
            <span className="text-xs font-semibold text-muted">{pix.status}</span>
          </Panel>
        ))}
      </section>
    </div>
  );
}
