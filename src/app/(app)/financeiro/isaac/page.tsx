import Link from "next/link";
import { AlertTriangle, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ImportarRepasseForm } from "@/components/isaac/importar-repasse-form";
import { requirePermission } from "@/lib/auth/session";
import { money } from "@/lib/constants";
import { getPendenciasIsaac, getRepassesIsaac, getUnidadesIsaac } from "@/lib/data/isaac";

export const dynamic = "force-dynamic";

export default async function RepasseIsaacPage() {
  await requirePermission("financeiro.isaac", "read");

  const [unidades, repasses, pendencias] = await Promise.all([
    getUnidadesIsaac(),
    getRepassesIsaac(),
    getPendenciasIsaac(),
  ]);

  const totalImportado = repasses.reduce((acc, r) => acc + r.liquido, 0);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Financeiro", href: "/financeiro" }, { label: "Repasse isaac" }]}
        title="Repasse isaac"
        description="O que o isaac de fato transferiu, por unidade e competência. A mensalidade é cobrada pelo isaac, que retém a taxa e repassa o líquido em duas transferências."
        kpis={[
          { label: "Repasses importados", value: String(repasses.length) },
          { label: "Total transferido", value: money.format(totalImportado) },
          {
            label: "Pendências abertas",
            value: String(pendencias.length),
            tone: pendencias.length > 0 ? "warning" : "default",
          },
        ]}
      />

      {pendencias.length > 0 ? (
        <Link
          href="/financeiro/isaac/pendencias"
          className="flex items-center gap-2 rounded-ui bg-gold/15 p-3 text-sm font-semibold text-clay transition-colors hover:bg-gold/25"
        >
          <AlertTriangle size={16} />
          {pendencias.length} parcela(s) aguardando decisão — ver fila
        </Link>
      ) : null}

      <ImportarRepasseForm unidades={unidades} />

      <Panel className="p-5">
        <p className="ds-kicker mb-3">Repasses importados</p>
        {repasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/60">
            <Receipt size={24} />
            <p className="text-sm">Nenhum repasse importado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                  <th className="px-3 py-2">Competência</th>
                  <th className="px-3 py-2">Unidade</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2 text-right">Líquido</th>
                  <th className="px-3 py-2 text-right">Parcelas</th>
                  <th className="px-3 py-2">Pendências</th>
                </tr>
              </thead>
              <tbody>
                {repasses.map((r) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className="px-3 py-2 font-semibold text-ink">{r.competenciaRepasse}</td>
                    <td className="px-3 py-2 text-ink/70">{r.unidadeNome}</td>
                    <td className="px-3 py-2 text-ink/70">{r.dataRepasse}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">{money.format(r.liquido)}</td>
                    <td className="px-3 py-2 text-right text-ink/70">{r.parcelas}</td>
                    <td className="px-3 py-2">
                      {r.pendencias > 0 ? (
                        <Badge tone="gold">{r.pendencias}</Badge>
                      ) : (
                        <Badge tone="green">—</Badge>
                      )}
                    </td>
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
