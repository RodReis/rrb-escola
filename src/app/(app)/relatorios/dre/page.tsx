import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarrasChart } from "@/components/relatorios/barras-chart";
import { ExportRelatorioButton } from "@/components/relatorios/export-relatorio-button";
import { money } from "@/lib/constants";
import { getLancamentosParaDRE } from "@/lib/data/relatorios-comercial";
import { montarDRE, resultadoPorEvento } from "@/lib/relatorios/dre";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DREPage({
  searchParams
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  await requirePermission("relatorios.dre", "read");
  const params = await searchParams;
  const compAtual = new Date().toISOString().slice(0, 7);
  const de = params.de ?? compAtual;
  const ate = params.ate ?? compAtual;

  const linhas = await getLancamentosParaDRE(de, ate);
  const dre = montarDRE(linhas);
  const eventos = resultadoPorEvento(linhas);

  const linhasExport = [
    ...dre.receitas.map((r) => ["Receita", r.categoria_nome, r.total]),
    ...dre.despesas.map((d) => ["Despesa", d.categoria_nome, d.total])
  ];

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Relatórios" }, { label: "DRE / Resultado" }]}
        title="DRE / Resultado"
        description="Receitas e despesas por categoria, por competência. Resultado por evento (centro de custo)."
        actions={<ExportRelatorioButton titulo="DRE" colunas={["Tipo", "Categoria", "Valor"]} linhas={linhasExport} nomeArquivo={`dre_${de}_${ate}`} />}
        kpis={[
          { label: "Receitas", value: money.format(dre.totalReceitas), tone: "success" },
          { label: "Despesas", value: money.format(dre.totalDespesas), tone: "danger" },
          { label: "Resultado", value: money.format(dre.resultado), tone: dre.resultado >= 0 ? "success" : "danger" }
        ]}
      />

      <Panel className="p-5">
        <form className="flex flex-wrap items-end gap-3">
          <label>De (competência)<input type="month" name="de" defaultValue={de} /></label>
          <label>Até (competência)<input type="month" name="ate" defaultValue={ate} /></label>
          <Button type="submit" variant="secondary">Aplicar</Button>
        </form>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-success">
            <TrendingUp size={12} /> Receitas por categoria
          </h2>
          <BarrasChart cor="var(--c-green)" data={dre.receitas.map((r) => ({ label: r.categoria_nome, valor: r.total }))} />
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-danger">
            <TrendingUp size={12} /> Despesas por categoria
          </h2>
          <BarrasChart cor="var(--c-coral)" data={dre.despesas.map((d) => ({ label: d.categoria_nome, valor: d.total }))} />
        </Panel>
      </div>

      {eventos.length > 0 && (
        <Panel className="p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-kicker text-ink/60">Resultado por evento</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                <th className="py-2 px-3">Evento</th>
                <th className="py-2 px-3 text-right">Receitas</th>
                <th className="py-2 px-3 text-right">Despesas</th>
                <th className="py-2 px-3 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.evento_id} className="border-t border-line">
                  <td className="py-2.5 px-3 font-medium text-ink">{e.evento_nome}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-success">{money.format(e.receitas)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-danger">{money.format(e.despesas)}</td>
                  <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${e.resultado >= 0 ? "text-success" : "text-danger"}`}>{money.format(e.resultado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
