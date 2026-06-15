import { Boxes, ArrowDownToLine, SlidersHorizontal, CheckCircle2, AlertCircle } from "lucide-react";
import { AlertasReposicao } from "@/components/comercial/alertas-reposicao";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/constants";
import { getSaldos } from "@/lib/data/estoque";
import { registrarEntradaAction, registrarAjusteAction } from "@/lib/actions/estoque";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function attrText(attrs: Record<string, string>) {
  const s = Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(", ");
  return s || "—";
}

export default async function EstoquePage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  await requirePermission("comercial.estoque", "read");
  const { erro, ok } = await searchParams;
  const saldos = await getSaldos();
  const hoje = new Date().toISOString().slice(0, 10);

  const alertas = saldos.filter((s) => s.precisa_reposicao);
  const imobilizado = saldos.reduce((acc, s) => acc + s.saldo * s.custo, 0);
  const opcoes = saldos.map((s) => ({
    id: s.variacao_id,
    label: `${s.produto_nome}${s.sku ? ` (${s.sku})` : ""} — saldo ${s.saldo}`
  }));

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Comercial" }, { label: "Estoque" }]}
        title="Estoque"
        description="Saldo por variação. Saída sai automática na venda; aqui você dá entrada e ajusta."
        kpis={[
          { label: "Variações", value: saldos.length.toLocaleString("pt-BR") },
          { label: "Reposição", value: alertas.length.toLocaleString("pt-BR"), tone: alertas.length > 0 ? "danger" : "success" },
          { label: "Imobilizado", value: money.format(imobilizado) }
        ]}
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}
      {ok ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> Movimento de {ok} registrado.
        </div>
      ) : null}

      <AlertasReposicao alertas={alertas} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
            <ArrowDownToLine size={12} /> Registrar entrada
          </h2>
          {opcoes.length === 0 ? (
            <p className="text-sm text-ink/45">Cadastre variações primeiro.</p>
          ) : (
            <form action={registrarEntradaAction} className="grid gap-3">
              <label>
                Variação
                <select name="variacao_id" required>
                  {opcoes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>Quantidade<input type="number" name="quantidade" min="1" required defaultValue="1" /></label>
                <label>Custo unit.<input type="number" name="custo_unit" step="0.01" min="0" /></label>
              </div>
              <label>Data<input type="date" name="data" required defaultValue={hoje} /></label>
              <label>Observação<input name="observacao" maxLength={300} placeholder="Ex.: NF 123 fornecedor" /></label>
              <Button type="submit" variant="primary">Dar entrada</Button>
            </form>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
            <SlidersHorizontal size={12} /> Ajuste de contagem
          </h2>
          {opcoes.length === 0 ? (
            <p className="text-sm text-ink/45">Cadastre variações primeiro.</p>
          ) : (
            <form action={registrarAjusteAction} className="grid gap-3">
              <label>
                Variação
                <select name="variacao_id" required>
                  {opcoes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  Sentido
                  <select name="sentido" defaultValue="1">
                    <option value="1">+ achou a mais</option>
                    <option value="-1">− achou a menos</option>
                  </select>
                </label>
                <label>Quantidade<input type="number" name="quantidade" min="1" required defaultValue="1" /></label>
              </div>
              <label>Data<input type="date" name="data" required defaultValue={hoje} /></label>
              <label>Observação<input name="observacao" maxLength={300} placeholder="Ex.: contagem mensal" /></label>
              <Button type="submit" variant="secondary">Ajustar</Button>
            </form>
          )}
        </Panel>
      </div>

      <Panel className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
          <Boxes size={12} /> Saldo por variação
        </h2>
        {saldos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-12 text-ink/40">
            <Boxes size={28} />
            <p className="text-sm">Nenhuma variação ativa.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
                  <th className="py-2 px-3">Produto</th>
                  <th className="py-2 px-3">SKU / Atributos</th>
                  <th className="py-2 px-3 text-right">Saldo</th>
                  <th className="py-2 px-3 text-right">Mínimo</th>
                  <th className="py-2 px-3 text-right">Imobilizado</th>
                  <th className="py-2 px-3">Últ. saída</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map((s) => (
                  <tr key={s.variacao_id} className={`border-t border-line ${s.precisa_reposicao ? "bg-danger/5" : ""}`}>
                    <td className="py-2.5 px-3 font-medium text-ink">{s.produto_nome}</td>
                    <td className="py-2.5 px-3 text-ink/70">{s.sku ?? "—"} · {attrText(s.atributos)}</td>
                    <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${s.precisa_reposicao ? "text-danger" : "text-ink"}`}>{s.saldo}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-ink/60">{s.estoque_minimo}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-ink/70">{money.format(s.saldo * s.custo)}</td>
                    <td className="py-2.5 px-3 text-ink/60 tabular-nums">{s.ultima_saida ? new Date(`${s.ultima_saida}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
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
