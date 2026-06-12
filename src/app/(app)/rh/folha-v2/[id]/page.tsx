import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { DataTableShell } from "@/components/ui/data-table";
import { getRunDetalhe } from "@/lib/data/folha";
import { money } from "@/lib/constants";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { RunAcoes } from "@/components/folha/run-acoes";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  paga: "Paga",
  fechada: "Fechada",
};

const STATUS_TONE: Record<string, StatusTone> = {
  rascunho: "warning",
  em_revisao: "neutral",
  aprovada: "neutral",
  paga: "success",
  fechada: "success",
};

function mesLabel(competencia: string) {
  const [y, m] = competencia.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[Number(m) - 1]} ${y}`;
}

type ItemRow = {
  id: string;
  status: string;
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  folha_contratos: {
    employees: { name: string } | null;
    folha_perfis_calculo: { nome: string } | null;
  } | null;
};

export default async function RunPage({ params }: { params: { id: string } }) {
  await requirePermission("rh.folha-v2", "read");

  const [run, supabase] = await Promise.all([
    getRunDetalhe(params.id),
    createServerClient(),
  ]);

  const { data: despesas } = await supabase
    .from("despesas")
    .select("descricao, valor, status, data_vencimento")
    .eq("folha_run_id", run.id);

  const editavel = ["rascunho", "em_revisao"].includes(run.status);
  const podeExportar = ["aprovada", "paga", "fechada"].includes(run.status);
  const company = run.companies as { name: string } | null;
  const itensAtivos = ((run.folha_itens ?? []) as unknown as ItemRow[]).filter(
    (i) => i.status === "ativo"
  );

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha de Pagamento v2", href: "/rh/folha-v2" },
          { label: mesLabel(run.competencia) },
        ]}
        title={`Folha ${mesLabel(run.competencia)} — ${company?.name ?? "—"}`}
        description={
          <StatusPill tone={STATUS_TONE[run.status] ?? "neutral"}>
            {STATUS_LABEL[run.status] ?? run.status}
          </StatusPill>
        }
      />

      <RunAcoes runId={run.id} status={run.status} />

      {podeExportar && (
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/folha/pacote/${run.id}`}
            className="ds-button ds-button-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <FileSpreadsheet size={14} />
            Pacote do contador (.xlsx)
          </a>
        </div>
      )}

      <DataTableShell
        footer={
          itensAtivos.length > 0 ? (
            <span>
              <strong className="text-ink">{itensAtivos.length}</strong> funcionário(s)
            </span>
          ) : undefined
        }
      >
        <table className="ds-dt min-w-[700px]">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Perfil</th>
              <th className="text-right">Proventos</th>
              <th className="text-right">Descontos</th>
              <th className="text-right">Líquido</th>
              <th className="text-right">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {itensAtivos.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink/40 text-sm">
                  Nenhum item nesta folha.
                </td>
              </tr>
            ) : null}
            {itensAtivos.map((i) => (
              <tr key={i.id}>
                <td className="font-medium">
                  {i.folha_contratos?.employees?.name ?? "—"}
                </td>
                <td className="text-ink/70">
                  {i.folha_contratos?.folha_perfis_calculo?.nome ?? "—"}
                </td>
                <td className="text-right tabular-nums">
                  {money.format(Number(i.total_proventos))}
                </td>
                <td className="text-right tabular-nums">
                  {money.format(Number(i.total_descontos))}
                </td>
                <td className="text-right tabular-nums font-medium">
                  {money.format(Number(i.liquido))}
                </td>
                <td className="text-right">
                  <Link
                    href={`/rh/folha-v2/${run.id}/item/${i.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    {editavel ? "Editar" : "Ver"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td colSpan={2}>Totais</td>
              <td className="text-right tabular-nums">
                {money.format(Number(run.total_proventos ?? 0))}
              </td>
              <td className="text-right tabular-nums">
                {money.format(Number(run.total_descontos ?? 0))}
              </td>
              <td className="text-right tabular-nums">
                {money.format(Number(run.total_liquido ?? 0))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </DataTableShell>

      {despesas && despesas.length > 0 ? (
        <Card>
          <p className="mb-3 text-xs font-bold uppercase tracking-kicker text-ink/55">
            Conciliação — despesas geradas
          </p>
          <ul className="divide-y divide-line">
            {despesas.map((d, ix) => (
              <li key={ix} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink/80">
                  {d.descricao}
                  {d.data_vencimento
                    ? ` (vence ${new Date(`${d.data_vencimento}T12:00:00Z`).toLocaleDateString("pt-BR")})`
                    : ""}
                </span>
                <span className="tabular-nums text-ink font-medium">
                  {money.format(Number(d.valor))}
                  <span className="ml-2 text-ink/50 font-normal">{d.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
