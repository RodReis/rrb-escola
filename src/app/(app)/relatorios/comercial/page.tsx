import { PackageX, BarChart3, Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarrasChart } from "@/components/relatorios/barras-chart";
import { ExportRelatorioButton } from "@/components/relatorios/export-relatorio-button";
import { money } from "@/lib/constants";
import { getVariacoesParaParado, getGiroVariacoes } from "@/lib/data/relatorios-comercial";
import { estoqueParado } from "@/lib/relatorios/estoque-parado";
import { curvaABC } from "@/lib/relatorios/abc";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default async function RelatoriosComercialPage({
  searchParams
}: {
  searchParams: Promise<{ janela?: string; baixa?: string; de?: string; ate?: string }>;
}) {
  await requirePermission("relatorios.comercial", "read");
  const params = await searchParams;
  const hoje = new Date().toISOString().slice(0, 10);
  const janela = Number(params.janela ?? "60");
  const baixa = params.baixa ? params.baixa.split(",").map(Number).filter((n) => n >= 1 && n <= 12) : [];

  const anoAtual = hoje.slice(0, 4);
  const de = params.de ?? `${anoAtual}-01-01`;
  const ate = params.ate ?? hoje;

  const [variacoes, giros] = await Promise.all([
    getVariacoesParaParado(),
    getGiroVariacoes(de, ate)
  ]);

  const parado = estoqueParado(variacoes, hoje, janela, baixa);
  const abc = curvaABC(giros);
  const imobilizadoTotal = variacoes.reduce((a, v) => a + v.saldo * v.custo, 0);

  const exportParado = parado.map((p) => [p.rotulo, p.saldo, p.diasParado ?? "nunca", p.valorImobilizado]);
  const exportAbc = abc.map((a) => [a.rotulo, a.quantidadeSaida, `${a.percentual.toFixed(1)}%`, a.classe]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Relatórios" }, { label: "Comercial" }]}
        title="Relatórios Comerciais"
        description="Estoque parado (com sazonalidade), curva ABC de giro e valor imobilizado."
        kpis={[
          { label: "Parados", value: parado.length.toLocaleString("pt-BR"), tone: parado.length > 0 ? "warning" : "success" },
          { label: "Imobilizado", value: money.format(imobilizadoTotal) },
          { label: "Variações", value: variacoes.length.toLocaleString("pt-BR") }
        ]}
      />

      <Panel className="p-5">
        <form className="flex flex-wrap items-end gap-3">
          <label>Janela (dias sem saída)<input type="number" name="janela" min="1" defaultValue={janela} /></label>
          <label>Giro de<input type="date" name="de" defaultValue={de} /></label>
          <label>Giro até<input type="date" name="ate" defaultValue={ate} /></label>
          <label>
            Excluir baixa temporada (meses)
            <select name="baixa" defaultValue={baixa.join(",")}>
              <option value="">Nenhum</option>
              <option value="6,7">Jun, Jul (meio do ano)</option>
              <option value="12,1">Dez, Jan (férias)</option>
              <option value="6,7,12,1">Jun, Jul, Dez, Jan</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">Aplicar</Button>
        </form>
      </Panel>

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
            <PackageX size={12} /> Estoque parado
          </h2>
          <ExportRelatorioButton titulo="Estoque parado" colunas={["Item", "Saldo", "Dias parado", "Imobilizado"]} linhas={exportParado} nomeArquivo="estoque_parado" />
        </div>
        {parado.length === 0 ? (
          <p className="text-sm text-ink/45">Nenhuma variação parada na janela configurada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
                <th className="py-2 px-3">Item</th>
                <th className="py-2 px-3 text-right">Saldo</th>
                <th className="py-2 px-3 text-right">Dias parado</th>
                <th className="py-2 px-3 text-right">Imobilizado</th>
              </tr>
            </thead>
            <tbody>
              {parado.map((p) => (
                <tr key={p.variacao_id} className="border-t border-line">
                  <td className="py-2.5 px-3 text-ink">{p.rotulo}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{p.saldo}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink/60">{p.diasParado ?? "nunca girou"}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{money.format(p.valorImobilizado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
            <BarChart3 size={12} /> Curva ABC (giro no período)
          </h2>
          <ExportRelatorioButton titulo="Curva ABC" colunas={["Item", "Saídas", "% do total", "Classe"]} linhas={exportAbc} nomeArquivo="curva_abc" />
        </div>
        {abc.length === 0 ? (
          <p className="text-sm text-ink/45">Sem saídas no período.</p>
        ) : (
          <>
            <BarrasChart data={abc.slice(0, 12).map((a) => ({ label: a.rotulo, valor: a.quantidadeSaida }))} />
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3 text-right">Saídas</th>
                  <th className="py-2 px-3 text-right">% total</th>
                  <th className="py-2 px-3">Classe</th>
                </tr>
              </thead>
              <tbody>
                {abc.map((a) => (
                  <tr key={a.variacao_id} className="border-t border-line">
                    <td className="py-2.5 px-3 text-ink">{a.rotulo}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{a.quantidadeSaida}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-ink/60">{a.percentual.toFixed(1)}%</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-bold ${
                        a.classe === "A" ? "bg-success/10 text-success" : a.classe === "B" ? "bg-warning/10 text-warning" : "bg-muted text-ink/55"
                      }`}>{a.classe}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Panel>

      <Panel className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
          <Boxes size={12} /> Valor imobilizado por item
        </h2>
        <BarrasChart cor="#7c3aed" data={[...variacoes].filter((v) => v.saldo > 0).sort((a, b) => b.saldo * b.custo - a.saldo * a.custo).slice(0, 12).map((v) => ({ label: v.rotulo, valor: v.saldo * v.custo }))} />
      </Panel>

      <p className="text-xs text-ink/45">Sazonalidade: meses marcados como baixa temporada não contam como giro ao avaliar &quot;parado&quot; (spec 6.4). Meses: {MESES.join(", ")}.</p>
    </div>
  );
}
