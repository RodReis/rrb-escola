import Link from "next/link";
import { FileSpreadsheet, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { DataTableShell } from "@/components/ui/data-table";
import { getRunDetalhe } from "@/lib/data/folha";
import { money } from "@/lib/constants";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { RunAcoes } from "@/components/folha/run-acoes";
import { FolhaStatusBadge } from "@/components/folha/folha-status-badge";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  iniciada:    "Iniciada",
  em_andamento: "Em andamento",
  revisao:     "Revisão",
  aprovacao:   "Aprovação",
  aprovado:    "Aprovado",
};

const STATUS_TONE: Record<string, StatusTone> = {
  iniciada:    "warning",
  em_andamento: "neutral",
  revisao:     "neutral",
  aprovacao:   "neutral",
  aprovado:    "success",
};

function mesLabel(competencia: string) {
  const [y, m] = competencia.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[Number(m) - 1]} ${y}`;
}

// Valor monetario com tom: zero apagado, demais por intencao (provento/desconto/liquido).
function Valor({ v, tone }: { v: number; tone?: "provento" | "desconto" | "liquido" }) {
  const zero = !v || v === 0;
  const cls = zero
    ? "text-ink/30"
    : tone === "desconto"
    ? "text-danger"
    : tone === "liquido"
    ? "font-bold text-ink"
    : tone === "provento"
    ? "text-success"
    : "text-ink";
  return <span className={`tabular-nums ${cls}`}>{money.format(Number(v))}</span>;
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

export default async function RunPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  await requirePermission("rh.folha-v2", "read");
  const { ok, erro } = await searchParams;

  const [run, supabase] = await Promise.all([
    getRunDetalhe(params.id),
    createServerClient(),
  ]);

  const { data: despesas } = await supabase
    .from("despesas")
    .select("descricao, valor, status, data_vencimento")
    .eq("folha_run_id", run.id);

  const editavel = ["iniciada", "em_andamento", "revisao"].includes(run.status);
  const podeExportar = run.status === "aprovado";
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
        description={<FolhaStatusBadge status={run.status} size="md" />}
      />

      {ok ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> Folha movida para “{STATUS_LABEL[ok] ?? ok}”.
        </div>
      ) : null}
      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}

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
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-kicker text-ink/45">Funcionário</th>
              <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-kicker text-ink/45">Perfil</th>
              <th className="px-4 py-3 text-right text-[0.68rem] font-bold uppercase tracking-kicker text-ink/45">Proventos</th>
              <th className="px-4 py-3 text-right text-[0.68rem] font-bold uppercase tracking-kicker text-ink/45">Descontos</th>
              <th className="px-4 py-3 text-right text-[0.68rem] font-bold uppercase tracking-kicker text-ink/45">Líquido</th>
              <th className="px-4 py-3 text-right text-[0.68rem] font-bold uppercase tracking-kicker text-ink/45">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {itensAtivos.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-ink/40 text-sm">
                  Nenhum item nesta folha.
                </td>
              </tr>
            ) : null}
            {itensAtivos.map((i) => {
              const nome = i.folha_contratos?.employees?.name ?? "—";
              const perfil = i.folha_contratos?.folha_perfis_calculo?.nome ?? "—";
              return (
                <tr
                  key={i.id}
                  className="border-b border-line/60 transition-colors odd:bg-transparent even:bg-muted/20 hover:bg-brand/[0.04]"
                >
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={nome} size={28} />
                      <span className="font-semibold text-ink">{nome}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-pill bg-brand/[0.08] px-2.5 py-0.5 text-xs font-semibold text-brand">
                      {perfil}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right"><Valor v={Number(i.total_proventos)} tone="provento" /></td>
                  <td className="px-4 py-2.5 text-right"><Valor v={Number(i.total_descontos)} tone="desconto" /></td>
                  <td className="px-4 py-2.5 text-right"><Valor v={Number(i.liquido)} tone="liquido" /></td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/rh/folha-v2/${run.id}/item/${i.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:gap-1.5 hover:underline transition-all"
                    >
                      {editavel ? "Editar" : "Ver"} <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 font-bold">
              <td className="px-4 py-3 text-ink/70 uppercase text-[0.68rem] tracking-kicker" colSpan={2}>Totais</td>
              <td className="px-4 py-3 text-right"><Valor v={Number(run.total_proventos ?? 0)} tone="provento" /></td>
              <td className="px-4 py-3 text-right"><Valor v={Number(run.total_descontos ?? 0)} tone="desconto" /></td>
              <td className="px-4 py-3 text-right"><Valor v={Number(run.total_liquido ?? 0)} tone="liquido" /></td>
              <td className="px-4 py-3" />
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
